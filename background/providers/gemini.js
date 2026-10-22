// background/providers/gemini.js
// Kết nối trực tiếp Google Gemini API (Gemini 3.8 Flash, 3.5 Flash-Lite, 3.x...)
// Danh sách model đồng bộ theo https://ai.google.dev/gemini-api/docs/models (10/2026)

import { cleanThinkTags } from "../prompts.js";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

// Các model đã bị Google tắt (Shut down) hoặc ID sai -> tự chuyển về model mặc định
const INVALID_GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro",
  "gemini-3-pro-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-computer-use-preview-10-2025"
];

// Chuỗi dự phòng: ưu tiên model Flash siêu tốc & Pro reasoning miễn phí
export const GEMINI_FALLBACK_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.1-pro-preview",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-4-argon",
  "gemini-2.5-flash"
];

export function sanitizeGeminiModel(model) {
  if (!model || INVALID_GEMINI_MODELS.includes(model)) {
    return DEFAULT_GEMINI_MODEL;
  }
  return model;
}

// Bộ nhớ đệm các model không hỗ trợ thinkingConfig để không bao giờ bị gọi lại 2 lần (tiết kiệm 50% thời gian)
const failedThinkingModels = new Set();

// Cấu hình suy nghĩ tối thiểu cho từng dòng model để trả lời nhanh nhất
// (Flash-lite tối ưu 0.2s không cần thinking)
function getThinkingConfig(model) {
  const m = model.toLowerCase();
  if (failedThinkingModels.has(model)) return null;
  if (m.includes("flash-lite")) {
    return null; // Flash-lite cực nhanh không cần thinking
  }
  if (m.startsWith("gemini-4") || m.includes("argon")) {
    return { thinkingLevel: "low" };
  }
  if (m.startsWith("gemini-3")) {
    const noMinimal = /gemini-3\.(8|7)-flash|gemini-3(\.1)?-pro/.test(m);
    return { thinkingLevel: noMinimal ? "low" : "minimal" };
  }
  if (m.includes("flash-latest")) {
    return { thinkingLevel: "low" };
  }
  if (m.includes("2.5-pro")) {
    return { thinkingBudget: 128 };
  }
  if (m.includes("2.5-flash")) {
    return { thinkingBudget: 0 };
  }
  return null;
}

// Dùng chung cho cả giải văn bản và Vision
export function buildGeminiGenerationConfig(model, maxTokens) {
  const thinkingConfig = getThinkingConfig(model);
  const generationConfig = {
    temperature: 0.0,
    maxOutputTokens: Math.max((maxTokens || 512) + (thinkingConfig ? 1024 : 0), 512)
  };
  if (thinkingConfig) generationConfig.thinkingConfig = thinkingConfig;
  return generationConfig;
}

function isTextGeminiModel(modelName) {
  const m = modelName.toLowerCase();
  const excludedKeywords = [
    "tts", "image", "embedding", "aqa", "audio", "robotics",
    "computer-use", "veo", "imagen", "learnlm", "bisheng", "thinking-exp",
    "live", "transcribe", "translate", "omni", "native-audio"
  ];
  return !excludedKeywords.some((kw) => m.includes(kw));
}

export function extractGeminiText(data) {
  const candidate = data?.candidates?.[0];
  if (!candidate?.content?.parts || !Array.isArray(candidate.content.parts)) {
    return null;
  }
  const textParts = candidate.content.parts
    .filter((p) => !p.thought && typeof p.text === "string" && p.text.trim().length > 0)
    .map((p) => p.text.trim());

  if (textParts.length > 0) {
    return textParts.join("\n");
  }

  const anyText = candidate.content.parts
    .filter((p) => typeof p.text === "string" && p.text.trim().length > 0)
    .map((p) => p.text.trim());

  return anyText.length > 0 ? anyText.join("\n") : null;
}

async function callGeminiSingleModel(model, cleanKey, promptText, maxTokens) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
  const generationConfig = buildGeminiGenerationConfig(model, maxTokens);
  const hasThinking = !!generationConfig.thinkingConfig;

  const payload = {
    contents: [
      {
        parts: [{ text: promptText }]
      }
    ],
    generationConfig
  };

  let response = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  let data = await response.json().catch(() => ({}));

  // Nếu model không nhận thinkingConfig -> ghi nhớ và gửi lại ngay không kèm cấu hình suy nghĩ
  if (!response.ok && response.status === 400 && hasThinking) {
    failedThinkingModels.add(model);
    delete payload.generationConfig.thinkingConfig;
    payload.generationConfig.maxOutputTokens = Math.max(maxTokens || 512, 512);
    response = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    data = await response.json().catch(() => ({}));
  }

  return { response, data };
}

export async function callGemini(questionText, storage, systemInstruction, maxTokens) {
  const apiKey = storage.geminiApiKey;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Chưa có Gemini API Key! Hãy tạo key miễn phí tại aistudio.google.com/apikey rồi dán vào tiện ích.");
  }

  const cleanKey = apiKey.trim();
  const preferredModel = sanitizeGeminiModel(storage.geminiModel);

  const fallbackModels = [preferredModel, ...GEMINI_FALLBACK_MODELS].filter(
    (v, i, a) => v && a.indexOf(v) === i
  );

  const promptText = `${systemInstruction}\n\n[ĐỀ BÀI CẦN GIẢI]:\n${questionText}`;
  let lastError = null;

  for (const model of fallbackModels) {
    try {
      const { response, data } = await callGeminiSingleModel(model, cleanKey, promptText, maxTokens);

      if (!response.ok) {
        const reason = data?.error?.details?.[0]?.reason || "";
        const errMsg = data?.error?.message || `HTTP ${response.status}`;

        if (reason === "API_KEY_SERVICE_BLOCKED") {
          throw new Error("Dự án Google của bạn chưa BẬT Generative Language API! Vào aistudio.google.com/apikey tạo key mới.");
        }
        if (reason === "API_KEY_INVALID" || errMsg.toLowerCase().includes("api key not valid")) {
          throw new Error("Gemini API Key không hợp lệ! Hãy kiểm tra lại mã key (bắt đầu bằng AIzaSy...).");
        }

        lastError = new Error(`Gemini (${response.status}): ${errMsg}`);
        continue;
      }

      const text = extractGeminiText(data);
      if (text) {
        return {
          text: cleanThinkTags(text),
          provider: "Gemini",
          model: model
        };
      }

      lastError = new Error(`Model ${model} không trả về văn bản.`);
    } catch (error) {
      if (error.message && (error.message.includes("Generative Language API") || error.message.includes("không hợp lệ"))) {
        throw error;
      }
      lastError = error;
    }
  }

  // Tự động dò model sống từ Google API nếu tất cả model mặc định đều lỗi
  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (listRes.ok) {
      const listData = await listRes.json();
      if (Array.isArray(listData.models)) {
        const discoveredModels = listData.models
          .filter(
            (m) =>
              Array.isArray(m.supportedGenerationMethods) &&
              m.supportedGenerationMethods.includes("generateContent")
          )
          .map((m) => m.name.replace(/^models\//, ""))
          .filter((m) => isTextGeminiModel(m) && !fallbackModels.includes(m));

        discoveredModels.sort((a, b) => (b.includes("flash") ? 1 : 0) - (a.includes("flash") ? 1 : 0));

        for (const liveM of discoveredModels.slice(0, 5)) {
          try {
            const { response, data } = await callGeminiSingleModel(liveM, cleanKey, promptText, maxTokens);
            const text = extractGeminiText(data);
            if (response.ok && text) {
              return {
                text: cleanThinkTags(text),
                provider: "Gemini",
                model: liveM
              };
            }
          } catch (_) {}
        }
      }
    }
  } catch (_) {}

  throw lastError || new Error("Không thể kết nối Google Gemini. Hãy kiểm tra API Key.");
}
