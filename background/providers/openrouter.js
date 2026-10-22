// background/providers/openrouter.js
// Kết nối trực tiếp OpenRouter API (Miễn phí: DeepSeek V3, DeepSeek R1, Llama 3.3 70B, Gemma 3)

import { cleanThinkTags } from "../prompts.js";
import { isDeepSeekKeyFormat, callDeepSeek } from "./deepseek.js";

const INVALID_OPENROUTER_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "qwen/qwen3.8-27b:free",
  "nvidia/nemotron-3.5-lightning:free"
];

export function sanitizeOpenRouterModel(model) {
  if (!model || INVALID_OPENROUTER_MODELS.includes(model)) {
    return "deepseek/deepseek-chat-v3-0324:free";
  }
  return model;
}

export async function callOpenRouter(questionText, storage, systemInstruction, maxTokens) {
  const apiKey = storage.openrouterApiKey;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Chưa có OpenRouter API Key! Vào openrouter.ai/keys để tạo key miễn phí (sk-or-v1-...).");
  }

  const cleanKey = apiKey.trim();

  // Tự động gọi DeepSeek nếu dán nhầm key DeepSeek vào ô OpenRouter
  if (isDeepSeekKeyFormat(cleanKey)) {
    return callDeepSeek(questionText, { ...storage, deepseekApiKey: cleanKey }, systemInstruction, maxTokens);
  }

  const preferredModel = sanitizeOpenRouterModel(storage.openrouterModel);
  const candidateModels = [
    preferredModel,
    "deepseek/deepseek-chat-v3-0324:free",
    "deepseek/deepseek-r1:free",
    "openrouter/free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-3-27b-it:free",
    "qwen/qwen-2.5-72b-instruct:free",
    "mistralai/mistral-small-3.1-24b-instruct:free"
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  const url = "https://openrouter.ai/api/v1/chat/completions";
  let lastError = null;
  const combinedPrompt = `${systemInstruction}\n\n[ĐỀ BÀI CẦN GIẢI]:\n${questionText}`;

  for (const model of candidateModels) {
    try {
      const isGemma = model.toLowerCase().includes("gemma");
      const messages = isGemma
        ? [{ role: "user", content: combinedPrompt }]
        : [
            { role: "system", content: systemInstruction },
            { role: "user", content: `Đọc kỹ và giải câu hỏi sau:\n${questionText}` }
          ];

      const response = await fetch(url, {
        method: "POST",
        signal: AbortSignal.timeout(16000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cleanKey}`,
          "HTTP-Referer": "https://wayground.vn",
          "X-Title": "Wayground AI Assistant"
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.0,
          max_tokens: Math.max(maxTokens || 450, 450)
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.error) {
        const errMsg = data?.error?.message || `HTTP ${response.status}`;
        if (response.status === 401) {
          throw new Error("OpenRouter API Key không hợp lệ! Hãy lấy key mới tại openrouter.ai/keys (dạng sk-or-v1-...).");
        }
        lastError = new Error(`OpenRouter (${response.status}): ${errMsg}`);
        continue;
      }

      const content = data?.choices?.[0]?.message?.content;
      if (content && content.trim()) {
        return {
          text: cleanThinkTags(content),
          provider: "OpenRouter",
          model
        };
      }
    } catch (err) {
      if (err.message && err.message.includes("không hợp lệ")) throw err;
      lastError = err;
    }
  }

  throw lastError || new Error("OpenRouter không trả về kết quả.");
}
