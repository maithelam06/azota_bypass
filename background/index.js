// background/index.js
// Điểm khởi chạy (Entry Point) của Service Worker Manifest V3

import { buildSystemInstruction } from "./prompts.js";
import { callGemini } from "./providers/gemini.js";
import { callDeepSeek, isDeepSeekKeyFormat } from "./providers/deepseek.js";
import { callGroq } from "./providers/groq.js";
import { callOpenAI } from "./providers/openai.js";
import { callClaude, isClaudeKeyFormat } from "./providers/claude.js";
import { callOpenRouter } from "./providers/openrouter.js";
import { handleCaptureAndSolve } from "./vision.js";

// 1. ĐĂNG KÝ MESSAGE LISTENER NGAY ĐẦU TIÊN
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || !request.action) return false;

  if (request.action === "PING") {
    sendResponse({ success: true, pong: true, version: "4.0.0" });
    return false;
  }

  if (request.action === "CALL_AI_API" || request.action === "CALL_GEMINI_API") {
    handleAIRequest(request.questionText)
      .then((result) =>
        sendResponse({
          success: true,
          data: result.text,
          provider: result.provider,
          model: result.model
        })
      )
      .catch((err) =>
        sendResponse({
          success: false,
          error: err?.message || String(err)
        })
      );
    return true; // Giữ kênh kết nối bất đồng bộ (async)
  }

  if (request.action === "CAPTURE_AND_SOLVE") {
    handleCaptureAndSolve(request, sender?.tab?.windowId, handleAIRequest)
      .then((result) =>
        sendResponse({
          success: true,
          data: result.text,
          provider: result.provider,
          model: result.model
        })
      )
      .catch((err) =>
        sendResponse({
          success: false,
          error: err?.message || String(err)
        })
      );
    return true;
  }

  if (request.action === "TEST_API_CONNECTION") {
    testApiConnection(request)
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((err) =>
        sendResponse({
          success: false,
          error: err?.message || String(err)
        })
      );
    return true;
  }

  return false;
});

// 2. KHỞI TẠO MENU CHUỘT PHẢI
function initContextMenus() {
  try {
    if (chrome.contextMenus) {
      chrome.contextMenus.removeAll(() => {
        void chrome.runtime.lastError;
        chrome.contextMenus.create(
          {
            id: "solveWithAI",
            title: "⚡ Giải nhanh bằng AI (Alt + Q)",
            contexts: ["selection"]
          },
          () => {
            void chrome.runtime.lastError;
          }
        );
      });
    }
  } catch (e) {
    console.warn("ContextMenus init warning:", e);
  }
}

// 3. TỰ ĐỘNG BƠM LẠI CONTENT SCRIPTS VÀO CÁC TAB ĐANG MỞ KHI TIỆN ÍCH RELOAD
function reinjectContentScriptsToOpenTabs() {
  try {
    if (!chrome.tabs || !chrome.scripting) return;
    chrome.tabs.query({}, (tabs) => {
      if (chrome.runtime.lastError || !tabs) return;
      for (const tab of tabs) {
        if (!tab.id || !tab.url) continue;
        if (
          tab.url.startsWith("chrome://") ||
          tab.url.startsWith("edge://") ||
          tab.url.startsWith("about:") ||
          tab.url.startsWith("chrome-extension://")
        ) {
          continue;
        }
        chrome.scripting
          .executeScript({
            target: { tabId: tab.id, allFrames: true },
            files: [
              "content/bypass.js",
              "content/scanner.js",
              "content/hud.js",
              "content/index.js"
            ]
          })
          .catch(() => {});
      }
    });
  } catch (_) {}
}

chrome.runtime.onInstalled.addListener(() => {
  initContextMenus();
  reinjectContentScriptsToOpenTabs();
});

if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "solveWithAI" && info.selectionText && tab?.id) {
      chrome.tabs.sendMessage(
        tab.id,
        {
          action: "PROCESS_SELECTION",
          text: info.selectionText
        },
        () => {
          void chrome.runtime.lastError;
        }
      );
    }
  });
}

// 4. LẮNG NGHE PHÍM TẮT TOÀN CỤC TỪ CHROME COMMANDS (Alt + Q, Alt + S, Alt + H)
if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener((command) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]?.id) return;
      const tabId = tabs[0].id;
      let action = null;
      if (command === "trigger_alt_q") action = "WG_HOTKEY_ALT_Q";
      else if (command === "pick_question") action = "WG_HOTKEY_ALT_S";
      else if (command === "hide_hud") action = "WG_HOTKEY_ALT_H";
      else if (command === "capture_solve") action = "WG_HOTKEY_ALT_V";

      if (action) {
        chrome.tabs.sendMessage(tabId, { action }, () => {
          void chrome.runtime.lastError;
        });
      }
    });
  });
}

function normalizeStorageKeys(storage) {
  const s = { ...storage };
  if (isDeepSeekKeyFormat(s.openaiApiKey) && !s.deepseekApiKey) {
    s.deepseekApiKey = s.openaiApiKey.trim();
  }
  return s;
}

// 4. XỬ LÝ YÊU CẦU GIẢI BÀI TỪ CONTENT SCRIPT
async function handleAIRequest(questionText) {
  const rawStorage = await chrome.storage.local.get([
    "aiProvider",
    "claudeApiKey",
    "claudeModel",
    "geminiApiKey",
    "geminiModel",
    "deepseekApiKey",
    "deepseekModel",
    "openaiApiKey",
    "openaiModel",
    "groqApiKey",
    "groqModel",
    "openrouterApiKey",
    "openrouterModel",
    "solveMode"
  ]);

  const storage = normalizeStorageKeys(rawStorage);
  let preferredProvider = storage.aiProvider || "gemini";

  if (preferredProvider === "chatgpt" && isDeepSeekKeyFormat(storage.openaiApiKey)) {
    preferredProvider = "deepseek";
  }

  const solveMode = storage.solveMode || "balanced";
  const { systemInstruction, maxTokens } = buildSystemInstruction(solveMode);

  const callers = {
    claude: () => callClaude(questionText, storage, systemInstruction, maxTokens),
    gemini: () => callGemini(questionText, storage, systemInstruction, maxTokens),
    deepseek: () => callDeepSeek(questionText, storage, systemInstruction, maxTokens),
    chatgpt: () => callOpenAI(questionText, storage, systemInstruction, maxTokens),
    groq: () => callGroq(questionText, storage, systemInstruction, maxTokens),
    openrouter: () => callOpenRouter(questionText, storage, systemInstruction, maxTokens)
  };

  const hasKey = {
    claude: !!(storage.claudeApiKey && storage.claudeApiKey.trim()),
    gemini: !!(storage.geminiApiKey && storage.geminiApiKey.trim()),
    deepseek: !!(storage.deepseekApiKey && storage.deepseekApiKey.trim()),
    chatgpt: !!(storage.openaiApiKey && storage.openaiApiKey.trim() && !isDeepSeekKeyFormat(storage.openaiApiKey)),
    groq: !!(storage.groqApiKey && storage.groqApiKey.trim()),
    openrouter: !!(storage.openrouterApiKey && storage.openrouterApiKey.trim())
  };

  if (!hasKey.claude && !hasKey.gemini && !hasKey.deepseek && !hasKey.chatgpt && !hasKey.groq && !hasKey.openrouter) {
    throw new Error(
      "Chưa có API Key! Hãy bấm vào biểu tượng Extension Wayground AI trên thanh công cụ → Nhập API Key → Bấm Lưu."
    );
  }

  const providersWithKey = Object.keys(callers).filter((p) => hasKey[p]);
  const tryOrder = hasKey[preferredProvider]
    ? [preferredProvider, ...providersWithKey.filter((p) => p !== preferredProvider)]
    : [...providersWithKey];

  let lastError = null;
  for (const p of tryOrder) {
    try {
      const result = await callers[p]();
      if (p !== preferredProvider && hasKey[preferredProvider]) {
        result.text = `⚠️ [Tự động chuyển sang ${result.provider} do ${preferredProvider} lỗi]\n\n${result.text}`;
      }
      return result;
    } catch (err) {
      console.warn(`[Fallback] Provider ${p} gặp lỗi:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error("Tất cả các dịch vụ AI đều không phản hồi.");
}

// 5. KIỂM TRA KẾT NỐI API
async function testApiConnection(req) {
  const stored = await chrome.storage.local.get([
    "aiProvider",
    "claudeApiKey",
    "claudeModel",
    "geminiApiKey",
    "geminiModel",
    "deepseekApiKey",
    "deepseekModel",
    "openaiApiKey",
    "openaiModel",
    "groqApiKey",
    "groqModel",
    "openrouterApiKey",
    "openrouterModel"
  ]);

  let provider = req.provider || stored.aiProvider || "gemini";
  const tempStorage = { ...stored, aiProvider: provider };

  if (provider === "claude") {
    if (req.apiKey !== undefined) tempStorage.claudeApiKey = req.apiKey;
    if (req.model !== undefined) tempStorage.claudeModel = req.model;
  } else if (provider === "gemini") {
    if (req.apiKey !== undefined) tempStorage.geminiApiKey = req.apiKey;
    if (req.model !== undefined) tempStorage.geminiModel = req.model;
  } else if (provider === "deepseek") {
    if (req.apiKey !== undefined) tempStorage.deepseekApiKey = req.apiKey;
    if (req.model !== undefined) tempStorage.deepseekModel = req.model;
  } else if (provider === "chatgpt") {
    if (req.apiKey !== undefined) tempStorage.openaiApiKey = req.apiKey;
    if (req.model !== undefined) tempStorage.openaiModel = req.model;
  } else if (provider === "groq") {
    if (req.apiKey !== undefined) tempStorage.groqApiKey = req.apiKey;
    if (req.model !== undefined) tempStorage.groqModel = req.model;
  } else if (provider === "openrouter") {
    if (req.apiKey !== undefined) tempStorage.openrouterApiKey = req.apiKey;
    if (req.model !== undefined) tempStorage.openrouterModel = req.model;
  }

  const startTime = Date.now();
  const testPrompt = "1 + 1 bằng mấy? Chỉ trả lời đúng con số.";
  const testSys = "Trả lời cực ngắn gọn.";

  let result;
  if (provider === "claude") {
    result = await callClaude(testPrompt, tempStorage, testSys, 64);
  } else if (provider === "gemini") {
    result = await callGemini(testPrompt, tempStorage, testSys, 128);
  } else if (provider === "deepseek") {
    result = await callDeepSeek(testPrompt, tempStorage, testSys, 64);
  } else if (provider === "groq") {
    result = await callGroq(testPrompt, tempStorage, testSys, 64);
  } else if (provider === "openrouter") {
    result = await callOpenRouter(testPrompt, tempStorage, testSys, 64);
  } else if (provider === "chatgpt") {
    result = await callOpenAI(testPrompt, tempStorage, testSys, 64);
  } else {
    throw new Error(`Provider không hợp lệ: ${provider}`);
  }

  const latencyMs = Date.now() - startTime;
  return {
    provider: result.provider,
    model: result.model,
    requestedModel: req.model,
    sampleReply: result.text,
    latencyMs
  };
}
