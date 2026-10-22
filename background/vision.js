// background/vision.js
// Chụp màn hình & Giải đề bằng AI Vision (Gemini Vision, Groq Vision, OpenRouter Vision, ChatGPT Vision)

import { buildSystemInstruction, cleanThinkTags } from "./prompts.js";
import {
  extractGeminiText,
  sanitizeGeminiModel,
  buildGeminiGenerationConfig,
  GEMINI_FALLBACK_MODELS
} from "./providers/gemini.js";
import { isDeepSeekKeyFormat } from "./providers/deepseek.js";

export async function handleCaptureAndSolve(request = {}, windowId = null, handleAIRequestFn) {
  const rawStorage = await chrome.storage.local.get([
    "aiProvider",
    "claudeApiKey",
    "claudeModel",
    "geminiApiKey",
    "geminiModel",
    "deepseekApiKey",
    "openaiApiKey",
    "groqApiKey",
    "openrouterApiKey",
    "solveMode"
  ]);

  const preferred = rawStorage.aiProvider || "gemini";
  const canvasText = (request?.canvasText || "").trim();

  // Nếu đề thi vẽ bằng Canvas và đã bắt được chữ ngầm, ưu tiên giải trực tiếp!
  if (canvasText.length >= 10 && preferred === "deepseek" && handleAIRequestFn) {
    const res = await handleAIRequestFn(canvasText);
    return {
      text: res.text,
      provider: `${res.provider} (Canvas Hook)`,
      model: res.model
    };
  }

  let dataUrl = request?.canvasDataUrl || null;
  if (!dataUrl) {
    try {
      dataUrl = await new Promise((resolve, reject) => {
        const captureOpts = { format: "jpeg", quality: 82 };
        const doCapture = (targetWinId) => {
          const cb = (imgUrl) => {
            if (chrome.runtime.lastError || !imgUrl) {
              const errMsg = chrome.runtime.lastError?.message || "Không thể chụp màn hình trang thi.";
              if (typeof targetWinId === "number") {
                // Thử lại không truyền windowId (mặc định lấy current window)
                try {
                  chrome.tabs.captureVisibleTab(captureOpts, (retryImg) => {
                    if (chrome.runtime.lastError || !retryImg) {
                      reject(new Error(chrome.runtime.lastError?.message || errMsg));
                    } else {
                      resolve(retryImg);
                    }
                  });
                } catch (e) {
                  reject(new Error(errMsg));
                }
              } else {
                reject(new Error(errMsg));
              }
            } else {
              resolve(imgUrl);
            }
          };

          try {
            if (typeof targetWinId === "number") {
              chrome.tabs.captureVisibleTab(targetWinId, captureOpts, cb);
            } else {
              chrome.tabs.captureVisibleTab(captureOpts, cb);
            }
          } catch (err) {
            try {
              chrome.tabs.captureVisibleTab(captureOpts, cb);
            } catch (err2) {
              reject(err2);
            }
          }
        };

        doCapture(typeof windowId === "number" ? windowId : undefined);
      });
    } catch (captureErr) {
      if (canvasText.length >= 10 && handleAIRequestFn) {
        const res = await handleAIRequestFn(canvasText);
        return {
          text: res.text,
          provider: `${res.provider} (Canvas Hook)`,
          model: res.model
        };
      }
      throw captureErr;
    }
  }

  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  const { systemInstruction, maxTokens } = buildSystemInstruction(rawStorage.solveMode || "balanced");
  const visionPrompt = `${systemInstruction}\n\nHãy đọc câu hỏi trắc nghiệm trong hình chụp màn hình này và đưa ra đáp án chính xác nhất theo đúng định dạng yêu cầu.`;

  const visionCallers = {
    claude: async () => {
      const key = rawStorage.claudeApiKey?.trim();
      if (!key) throw new Error("Chưa nhập Claude API Key 🔑");
      const m = rawStorage.claudeModel || "claude-3-7-sonnet-latest";
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: AbortSignal.timeout(22000),
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: m,
          max_tokens: 1024,
          system: systemInstruction,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: base64Data
                  }
                },
                {
                  type: "text",
                  text: visionPrompt
                }
              ]
            }
          ]
        })
      });
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data?.content)) {
        const textBlock = data.content.find((c) => c.type === "text");
        if (textBlock && textBlock.text) {
          return { text: cleanThinkTags(textBlock.text.trim()), provider: "Claude Vision", model: m };
        }
      }
      throw new Error(data?.error?.message || "Claude Vision không phản hồi.");
    },
    gemini: async () => {
      const key = rawStorage.geminiApiKey?.trim();
      if (!key) throw new Error("Chưa nhập Gemini API Key 🔑");
      const visionModels = [sanitizeGeminiModel(rawStorage.geminiModel), ...GEMINI_FALLBACK_MODELS]
        .filter((v, i, a) => v && a.indexOf(v) === i)
        .slice(0, 4);
      let lastGeminiErr = null;
      for (const m of visionModels) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`;
        const genConfig = buildGeminiGenerationConfig(m, maxTokens);
        const makeBody = (cfg) => JSON.stringify({
          contents: [
            {
              parts: [
                { text: visionPrompt },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: base64Data
                  }
                }
              ]
            }
          ],
          generationConfig: cfg
        });

        let res = await fetch(url, {
          method: "POST",
          signal: AbortSignal.timeout(20000),
          headers: { "Content-Type": "application/json" },
          body: makeBody(genConfig)
        }).catch((err) => {
          lastGeminiErr = err;
          return null;
        });

        // Nếu model 400 Bad Request do thinkingConfig, gửi lại không kèm thinkingConfig
        if (res && !res.ok && res.status === 400 && genConfig.thinkingConfig) {
          const fallbackCfg = { ...genConfig };
          delete fallbackCfg.thinkingConfig;
          res = await fetch(url, {
            method: "POST",
            signal: AbortSignal.timeout(20000),
            headers: { "Content-Type": "application/json" },
            body: makeBody(fallbackCfg)
          }).catch((err) => {
            lastGeminiErr = err;
            return null;
          });
        }

        if (!res) continue;
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          lastGeminiErr = new Error(data?.error?.message || `Gemini Vision HTTP ${res.status}`);
          continue;
        }
        const text = extractGeminiText(data);
        if (text) return { text, provider: "Gemini Vision", model: m };
      }
      throw lastGeminiErr || new Error("Gemini Vision không phản hồi.");
    },
    groq: async () => {
      const key = rawStorage.groqApiKey?.trim();
      if (!key) throw new Error("Chưa nhập Groq API Key 🔑");
      const groqModels = ["qwen/qwen3.8-27b", "llama-3.2-11b-vision-preview", "llama-3.2-90b-vision-preview"];
      let lastGroqErr = null;
      for (const m of groqModels) {
        try {
          const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            signal: AbortSignal.timeout(15000),
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`
            },
            body: JSON.stringify({
              model: m,
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: visionPrompt },
                    { type: "image_url", image_url: { url: dataUrl } }
                  ]
                }
              ],
              temperature: 0.0,
              max_tokens: 450
            })
          });
          const data = await res.json().catch(() => ({}));
          const content = data?.choices?.[0]?.message?.content;
          if (res.ok && content) return { text: cleanThinkTags(content), provider: "Groq Vision", model: m };
          lastGroqErr = new Error(data?.error?.message || `Groq Vision HTTP ${res.status}`);
        } catch (e) {
          lastGroqErr = e;
        }
      }
      throw lastGroqErr || new Error("Groq Vision không phản hồi.");
    },
    openrouter: async () => {
      const key = rawStorage.openrouterApiKey?.trim();
      if (!key) throw new Error("Chưa nhập OpenRouter API Key 🔑");
      for (const m of ["google/gemma-3-27b-it:free", "openrouter/free", "meta-llama/llama-3.2-11b-vision-instruct:free"]) {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          signal: AbortSignal.timeout(16000),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
            "HTTP-Referer": "https://wayground.vn",
            "X-Title": "Wayground AI Assistant"
          },
          body: JSON.stringify({
            model: m,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: visionPrompt },
                  { type: "image_url", image_url: { url: dataUrl } }
                ]
              }
            ],
            temperature: 0.0,
            max_tokens: 450
          })
        });
        const data = await res.json().catch(() => ({}));
        const content = data?.choices?.[0]?.message?.content;
        if (res.ok && content) return { text: cleanThinkTags(content), provider: "OpenRouter Vision", model: m };
      }
      throw new Error("OpenRouter Vision không phản hồi.");
    },
    chatgpt: async () => {
      const key = rawStorage.openaiApiKey?.trim();
      if (!key || isDeepSeekKeyFormat(key)) throw new Error("Chưa nhập OpenAI API Key 🔑");
      const m = "gpt-4o-mini";
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`
        },
        body: JSON.stringify({
          model: m,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: visionPrompt },
                { type: "image_url", image_url: { url: dataUrl } }
              ]
            }
          ],
          temperature: 0.0,
          max_tokens: 450
        })
      });
      const data = await res.json().catch(() => ({}));
      const content = data?.choices?.[0]?.message?.content;
      if (res.ok && content) return { text: content, provider: "ChatGPT Vision", model: m };
      throw new Error(data?.error?.message || "OpenAI Vision lỗi");
    }
  };

  const hasKey = {
    claude: !!(rawStorage.claudeApiKey && rawStorage.claudeApiKey.trim()),
    gemini: !!(rawStorage.geminiApiKey && rawStorage.geminiApiKey.trim()),
    groq: !!(rawStorage.groqApiKey && rawStorage.groqApiKey.trim()),
    openrouter: !!(rawStorage.openrouterApiKey && rawStorage.openrouterApiKey.trim()),
    chatgpt: !!(rawStorage.openaiApiKey && rawStorage.openaiApiKey.trim() && !isDeepSeekKeyFormat(rawStorage.openaiApiKey))
  };

  const providersWithKey = Object.keys(visionCallers).filter((p) => hasKey[p]);
  const order = hasKey[preferred]
    ? [preferred, ...providersWithKey.filter((p) => p !== preferred)]
    : [...providersWithKey, ...Object.keys(visionCallers).filter((p) => !hasKey[p])];

  let lastErr = null;
  for (const p of order) {
    try {
      return await visionCallers[p]();
    } catch (e) {
      lastErr = e;
    }
  }

  if (canvasText.length >= 10 && handleAIRequestFn) {
    const res = await handleAIRequestFn(canvasText);
    return {
      text: res.text,
      provider: `${res.provider} (Canvas Hook)`,
      model: res.model
    };
  }

  throw lastErr || new Error("⚠️ Để chụp ảnh giải đề, bạn cần nhập API Key của Gemini (Google AI Studio - Miễn phí), Groq hoặc ChatGPT trong phần Cài đặt.");
}
