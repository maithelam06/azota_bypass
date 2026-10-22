// background/providers/openai.js
// Kết nối trực tiếp OpenAI API (ChatGPT GPT-4o-mini, GPT-4.1-mini, GPT-4o)

import { isDeepSeekKeyFormat, callDeepSeek } from "./deepseek.js";

export async function callOpenAI(questionText, storage, systemInstruction, maxTokens) {
  const apiKey = storage.openaiApiKey;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Chưa có OpenAI API Key! Hãy mở tiện ích để nhập key OpenAI (dạng sk-proj-...).");
  }

  const cleanKey = apiKey.trim();

  // Tự động chuyển sang DeepSeek nếu dán nhầm key DeepSeek vào ô OpenAI
  if (isDeepSeekKeyFormat(cleanKey)) {
    return callDeepSeek(questionText, { ...storage, deepseekApiKey: cleanKey }, systemInstruction, maxTokens);
  }

  const preferredModel = storage.openaiModel || "gpt-4o-mini";
  const candidateModels = [preferredModel, "o1", "o3-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4o-mini"].filter(
    (v, i, a) => v && a.indexOf(v) === i
  );

  const url = "https://api.openai.com/v1/chat/completions";
  let lastError = null;

  for (const model of candidateModels) {
    try {
      const isReasoning = model.startsWith("o1") || model.startsWith("o3") || model.startsWith("o4");
      const payload = {
        model,
        messages: [
          { role: isReasoning ? "developer" : "system", content: systemInstruction },
          { role: "user", content: `Đọc kỹ và giải câu hỏi sau:\n${questionText}` }
        ]
      };

      if (isReasoning) {
        payload.max_completion_tokens = Math.max(maxTokens || 600, 600);
      } else {
        payload.temperature = 0.0;
        payload.max_tokens = Math.max(maxTokens || 450, 450);
      }

      const response = await fetch(url, {
        method: "POST",
        signal: AbortSignal.timeout(14000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cleanKey}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errMsg = data?.error?.message || `HTTP ${response.status}`;
        if (response.status === 401) {
          throw new Error("OpenAI API Key không hợp lệ hoặc đã hết hạn!");
        }
        if (response.status === 429 && (errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("credit"))) {
          throw new Error("Tài khoản OpenAI của bạn đã hết số dư/credits ($0 balance)! Bạn cần nạp tiền vào Billing (platform.openai.com) hoặc chuyển sang dùng Groq / Gemini (Miễn phí 100%).");
        }
        lastError = new Error(`OpenAI (${response.status}): ${errMsg}`);
        continue;
      }

      const content = data?.choices?.[0]?.message?.content;
      if (content && content.trim()) {
        return {
          text: content.trim(),
          provider: "ChatGPT",
          model
        };
      }
    } catch (err) {
      if (err.message && (err.message.includes("không hợp lệ") || err.message.includes("hết số dư") || err.message.includes("Insufficient Quota"))) {
        throw err;
      }
      lastError = err;
    }
  }

  throw lastError || new Error("ChatGPT không trả về kết quả.");
}
