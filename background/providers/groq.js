// background/providers/groq.js
// Kết nối trực tiếp Groq API siêu tốc độ (Llama 3.3 70B, DeepSeek R1 70B)

import { cleanThinkTags } from "../prompts.js";
import { isDeepSeekKeyFormat } from "./deepseek.js";

const INVALID_GROQ_MODELS = [
  "llama-3.1-70b-versatile",
  "gemma2-9b-it",
  "mixtral-8x7b-32768",
  "qwen/qwen3-32b",
  "qwen-qwq-32b",
  "meta-llama/llama-4-maverick-17b-128e-instruct"
];

export function sanitizeGroqModel(model) {
  if (!model || INVALID_GROQ_MODELS.includes(model)) {
    return "llama-3.3-70b-versatile";
  }
  return model;
}

export async function fetchLiveGroqChatModels(cleanKey) {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      method: "GET",
      signal: AbortSignal.timeout(6000),
      headers: { Authorization: `Bearer ${cleanKey}` }
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    const list = Array.isArray(data?.data) ? data.data : [];
    const ignoreKeywords = [
      "whisper", "tts", "playai", "guard", "orpheus", "embed", "vision", "qwen3-32b"
    ];
    return list
      .map((m) => m.id)
      .filter((id) => id && !ignoreKeywords.some((kw) => id.toLowerCase().includes(kw)));
  } catch (_) {
    return [];
  }
}

export async function callGroq(questionText, storage, systemInstruction, maxTokens) {
  const apiKey = storage.groqApiKey;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Chưa có Groq API Key! Hãy mở tiện ích để nhập key Groq (bắt đầu bằng gsk_...).");
  }

  const cleanKey = apiKey.trim();
  const preferredModel = sanitizeGroqModel(storage.groqModel);

  // Ưu tiên tuyệt đối các model lớn thông minh (70B / DeepSeek R1 70B / Llama 4), đẩy 8B xuống cuối cùng!
  let candidateModels = [
    preferredModel,
    "llama-3.3-70b-versatile",
    "deepseek-r1-distill-llama-70b",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "llama-3.1-8b-instant"
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  const url = "https://api.groq.com/openai/v1/chat/completions";
  let primaryError = null;
  let lastError = null;
  let fetchedLiveModels = false;
  let retried70B = false;

  for (let i = 0; i < candidateModels.length; i++) {
    const model = candidateModels[i];
    try {
      const response = await fetch(url, {
        method: "POST",
        signal: AbortSignal.timeout(12000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cleanKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: `Đọc kỹ và giải câu hỏi sau:\n${questionText}` }
          ],
          temperature: 0.0,
          max_tokens: Math.max(maxTokens || 512, 512)
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errMsg = data?.error?.message || `HTTP ${response.status}`;
        if (response.status === 401) {
          throw new Error("Groq API Key không hợp lệ! Hãy kiểm tra lại key (bắt đầu bằng gsk_...).");
        }

        const currentErr = new Error(`Groq (${response.status} - ${model}): ${errMsg}`);
        if (!primaryError && response.status !== 404) {
          primaryError = currentErr;
        }
        lastError = currentErr;

        // Nếu model 70B bị giới hạn tốc độ tức thời (429), nghỉ 1.2s rồi thử lại chính model 70B đó
        if (response.status === 429) {
          await new Promise((r) => setTimeout(r, 1200));
          if (model === "llama-3.3-70b-versatile" && !retried70B) {
            retried70B = true;
            i--;
            continue;
          }
        }

        // Nếu báo 404 (Model chưa bật trên tài khoản), tự động lấy danh sách model thực tế!
        if (response.status === 404 && !fetchedLiveModels) {
          fetchedLiveModels = true;
          const liveModels = await fetchLiveGroqChatModels(cleanKey);
          for (const lm of liveModels) {
            if (!candidateModels.includes(lm)) {
              candidateModels.push(lm);
            }
          }
        }
        continue;
      }

      const rawContent = data?.choices?.[0]?.message?.content;
      const cleaned = cleanThinkTags(rawContent);
      if (cleaned) {
        return {
          text: cleaned,
          provider: model === "llama-3.1-8b-instant" ? "Groq (8B)" : "Groq (70B)",
          model
        };
      }
    } catch (err) {
      if (err.message && err.message.includes("không hợp lệ")) throw err;
      lastError = err;
    }
  }

  throw primaryError || lastError || new Error("Groq không phản hồi. Vui lòng kiểm tra lại kết nối!");
}
