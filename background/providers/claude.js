// background/providers/claude.js
// Kết nối trực tiếp Anthropic Claude API (api.anthropic.com)
// Hỗ trợ Claude 3.7 Sonnet (Hybrid Reasoning - Mạnh nhất thế giới 2026), Claude 3.5 Sonnet, Claude 3.5 Haiku

import { cleanThinkTags } from "../prompts.js";

export function isClaudeKeyFormat(key) {
  if (!key) return false;
  return /^sk-ant-[a-zA-Z0-9_\-]{16,}$/i.test(key.trim());
}

export async function callClaude(questionText, storage, systemInstruction, maxTokens) {
  const apiKey = storage.claudeApiKey;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Chưa có Anthropic Claude API Key! Hãy vào console.anthropic.com để lấy key (dạng sk-ant-...).");
  }

  const cleanKey = apiKey.trim();
  const preferredModel = storage.claudeModel || "claude-3-7-sonnet-latest";
  const candidateModels = [
    preferredModel,
    "claude-3-7-sonnet-latest",
    "claude-3-7-sonnet-20250219",
    "claude-3-5-sonnet-latest",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-latest"
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  const url = "https://api.anthropic.com/v1/messages";
  let lastError = null;

  for (const model of candidateModels) {
    try {
      const is37Sonnet = model.includes("3-7-sonnet");
      const payload = {
        model,
        max_tokens: Math.max(maxTokens || 1024, 1024),
        system: systemInstruction,
        messages: [
          { role: "user", content: `Đọc kỹ và giải câu hỏi sau:\n${questionText}` }
        ]
      };

      // Tối ưu thinking budget cho Claude 3.7 nếu giải bài khó
      if (is37Sonnet && storage.solveMode === "deep") {
        payload.thinking = {
          type: "enabled",
          budget_tokens: 1024
        };
        payload.max_tokens = 2048;
      }

      const response = await fetch(url, {
        method: "POST",
        signal: AbortSignal.timeout(22000),
        headers: {
          "Content-Type": "application/json",
          "x-api-key": cleanKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errMsg = data?.error?.message || `HTTP ${response.status}`;
        if (response.status === 401) {
          throw new Error("Anthropic Claude API Key không hợp lệ hoặc đã hết hạn!");
        }
        if (response.status === 429) {
          throw new Error(`Claude (429): Quá hạn mức hoặc hết số dư. ${errMsg}`);
        }
        if (response.status === 400 && payload.thinking) {
          // Thử lại không kèm thinking
          delete payload.thinking;
          payload.max_tokens = 1024;
          const retryRes = await fetch(url, {
            method: "POST",
            signal: AbortSignal.timeout(20000),
            headers: {
              "Content-Type": "application/json",
              "x-api-key": cleanKey,
              "anthropic-version": "2023-06-01",
              "anthropic-dangerous-direct-browser-access": "true"
            },
            body: JSON.stringify(payload)
          });
          const retryData = await retryRes.json().catch(() => ({}));
          if (retryRes.ok && Array.isArray(retryData?.content)) {
            const textBlock = retryData.content.find((c) => c.type === "text");
            if (textBlock && textBlock.text) {
              return {
                text: cleanThinkTags(textBlock.text.trim()),
                provider: "Claude",
                model
              };
            }
          }
        }
        lastError = new Error(`Claude (${response.status}): ${errMsg}`);
        continue;
      }

      if (Array.isArray(data?.content)) {
        const textBlock = data.content.find((c) => c.type === "text");
        if (textBlock && textBlock.text) {
          return {
            text: cleanThinkTags(textBlock.text.trim()),
            provider: "Claude",
            model
          };
        }
      }
    } catch (err) {
      if (err.message && (err.message.includes("không hợp lệ") || err.message.includes("429"))) {
        throw err;
      }
      lastError = err;
    }
  }

  throw lastError || new Error("Anthropic Claude không trả về kết quả.");
}
