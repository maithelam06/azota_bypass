// background/providers/deepseek.js
// Kết nối trực tiếp DeepSeek API (api.deepseek.com)

import { cleanThinkTags } from "../prompts.js";

export function isDeepSeekKeyFormat(key) {
  if (!key) return false;
  return /^sk-[0-9a-f]{32}$/i.test(key.trim());
}

export async function callDeepSeek(questionText, storage, systemInstruction, maxTokens) {
  const apiKey = storage.deepseekApiKey;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Chưa có DeepSeek API Key! Hãy vào platform.deepseek.com để lấy key (dạng sk-...).");
  }

  const cleanKey = apiKey.trim();
  const preferredModel = storage.deepseekModel || "deepseek-chat";
  const isReasoner = preferredModel === "deepseek-reasoner";
  const candidateModels = isReasoner
    ? ["deepseek-reasoner", "deepseek-chat"]
    : ["deepseek-chat", "deepseek-reasoner"];

  const url = "https://api.deepseek.com/chat/completions";
  let lastError = null;

  for (const model of candidateModels) {
    try {
      const isR1 = model === "deepseek-reasoner";
      const payload = {
        model,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: `Đọc kỹ và giải câu hỏi trắc nghiệm sau:\n${questionText}` }
        ]
      };

      if (isR1) {
        payload.max_tokens = Math.max(maxTokens || 1024, 1024);
      } else {
        payload.temperature = 0.0;
        payload.max_tokens = Math.max(maxTokens || 512, 512);
      }

      const response = await fetch(url, {
        method: "POST",
        signal: AbortSignal.timeout(18000),
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
          throw new Error("DeepSeek API Key không hợp lệ! Hãy kiểm tra lại key.");
        }
        if (response.status === 402 || errMsg.toLowerCase().includes("insufficient balance")) {
          throw new Error("Tài khoản DeepSeek của bạn đã hết số dư (Insufficient Balance).");
        }
        lastError = new Error(`DeepSeek (${response.status}): ${errMsg}`);
        continue;
      }

      const content = data?.choices?.[0]?.message?.content;
      if (content && content.trim()) {
        return {
          text: cleanThinkTags(content),
          provider: isR1 ? "DeepSeek R1" : "DeepSeek V3",
          model
        };
      }
    } catch (err) {
      if (err.message && (err.message.includes("không hợp lệ") || err.message.includes("Insufficient Balance"))) {
        throw err;
      }
      lastError = err;
    }
  }

  throw lastError || new Error("DeepSeek không trả về kết quả.");
}
