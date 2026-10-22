// Background Service Worker - Wayground AI Assistant (Gemini, DeepSeek, ChatGPT, Groq & OpenRouter Turbo)

// 1. ĐĂNG KÝ MESSAGE LISTENER NGAY ĐẦU TIÊN (Đảm bảo không bao giờ mất kết nối)
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
    handleCaptureAndSolve(request, sender?.tab?.windowId)
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
    return true; // Giữ kênh kết nối bất đồng bộ (async)
  }

  return false;
});

// 2. KHỞI TẠO MENU CHUỘT PHẢI AN TOÀN (Có bảo vệ tránh crash Service Worker)
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

// ==========================================
// TIỆN ÍCH CHUẨN HÓA KEY & MODEL
// ==========================================
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

const INVALID_GROQ_MODELS = [
  "llama-3.1-70b-versatile",
  "gemma2-9b-it",
  "mixtral-8x7b-32768",
  "qwen/qwen3-32b",
  "qwen-qwq-32b",
  "meta-llama/llama-4-maverick-17b-128e-instruct"
];

const INVALID_OPENROUTER_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "qwen/qwen3.8-27b:free",
  "nvidia/nemotron-3.5-lightning:free"
];

function sanitizeGeminiModel(model) {
  if (!model || INVALID_GEMINI_MODELS.includes(model)) {
    return "gemini-3.5-flash-lite";
  }
  return model;
}

function sanitizeGroqModel(model) {
  if (!model || INVALID_GROQ_MODELS.includes(model)) {
    return "llama-3.3-70b-versatile";
  }
  return model;
}

function sanitizeOpenRouterModel(model) {
  if (!model || INVALID_OPENROUTER_MODELS.includes(model)) {
    return "deepseek/deepseek-chat-v3-0324:free";
  }
  return model;
}

// Nhận diện chính xác key DeepSeek (sk- kèm 32 ký tự hex) vs OpenAI (sk-proj-... / dài hơn)
function isDeepSeekKeyFormat(key) {
  if (!key) return false;
  return /^sk-[0-9a-f]{32}$/i.test(key.trim());
}

function cleanThinkTags(text) {
  if (!text) return "";
  let cleaned = text;

  // Nếu là mô hình suy luận bản địa (như DeepSeek R1) có khối <think>...</think>, loại bỏ khối nháp
  if (cleaned.includes("</think>")) {
    cleaned = cleaned.substring(cleaned.indexOf("</think>") + 8).trim();
  } else {
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  }

  // Loại bỏ các thẻ <think> hoặc </think> còn sót lại nếu có
  cleaned = cleaned.replace(/<\/?think>/gi, "").trim();

  return cleaned || text.trim();
}

function buildSystemInstruction(solveMode) {
  if (solveMode === "ultra_fast") {
    return {
      systemInstruction: `Bạn là trợ lý giải đề thi siêu tốc, mục tiêu đạt 10/10.
YÊU CẦU:
1. Đọc thật kỹ câu hỏi, lưu ý các từ phủ định (KHÔNG, SAI, NGOẠI TRỪ, KHÔNG ĐÚNG).
2. Dòng 1: Xuất ngay "👉 ĐÁP ÁN: [A/B/C/D] - [Nội dung đáp án]".
3. Không viết lời chào, không lặp lại câu hỏi.`,
      maxTokens: 256
    };
  }

  if (solveMode === "deep") {
    return {
      systemInstruction: `Bạn là giáo sư chuyên gia giải đề thi học thuật đạt điểm tuyệt đối 10/10.
YÊU CẦU:
1. Cảnh giác cao độ với bẫy phủ định: "KHÔNG", "SAI", "NGOẠI TRỪ", "KHÔNG ĐÚNG".
2. Dòng 1: 👉 ĐÁP ÁN: [A/B/C/D] - [Nội dung đầy đủ của đáp án đúng]
3. Dòng 2 trở đi: Phân tích cặn kẽ từng bước, tính toán chi tiết và chỉ rõ vì sao các phương án còn lại sai.`,
      maxTokens: 1024
    };
  }

  // Chế độ Chuẩn (Đạt điểm tối đa 10/10)
  return {
    systemInstruction: `Bạn là chuyên gia thẩm định và giải đề thi trắc nghiệm đỉnh cao, cam kết ĐẠT ĐIỂM TỐI ĐA 10/10.

QUY TẮC BẮT BUỘC ĐỂ KHÔNG BAO GIỜ SAI BẪY:
1. BẪY TỪ PHỦ ĐỊNH (RẤT QUAN TRỌNG):
   - Đọc kỹ xem câu hỏi có chứa các từ: "KHÔNG", "SAI", "NGOẠI TRỪ", "KHÔNG ĐÚNG", "CHƯA ĐÚNG", "KHÔNG CHÍNH XÁC" hay không.
   - Nếu có từ phủ định: Mục tiêu bắt buộc là tìm khẳng định SAI để chọn làm đáp án!
2. ĐỐI VỚI BÀI TOÁN / KHOA HỌC TỰ NHIÊN / TIN HỌC:
   - Áp dụng đúng công thức, tính toán từng bước chính xác trước khi so sánh với 4 phương án.
3. ĐỐI VỚI NGOẠI NGỮ / TIẾNG ANH:
   - Xét kỹ thì của câu, hòa hợp chủ vị, cụm cố định (collocation), liên từ, mệnh đề quan hệ.
4. ĐỐI VỚI PHÁP LUẬT VIỆT NAM / THẨM QUYỀN BAN HÀNH VĂN BẢN QUY PHẠM PHÁP LUẬT (BẮT BUỘC TUÂN THỦ TUYỆT ĐỐI):
   - Quốc hội: Hiến pháp, Luật, Nghị quyết.
   - Ủy ban Thường vụ Quốc hội (UBTVQH): Pháp lệnh, Nghị quyết.
   - Chủ tịch nước: Lệnh, Quyết định.
   - Chính phủ: Nghị định, Nghị quyết.
   - UBTVQH hoặc Chính phủ phối hợp với Đoàn Chủ tịch UBTW MTTQVN: Nghị quyết liên tịch.
   - Thủ tướng Chính phủ: Quyết định.
   - Bộ trưởng, Thủ trưởng cơ quan ngang bộ, Chánh án TANDTC, Viện trưởng VKSNDTC, Tổng Kiểm toán nhà nước: Thông tư.
   - Hội đồng Thẩm phán TANDTC: Nghị quyết.
   - Giữa Bộ trưởng, Thủ trưởng cơ quan ngang bộ, Chánh án TANDTC, Viện trưởng VKSNDTC, Tổng Kiểm toán nhà nước (phối hợp): Thông tư liên tịch.
   - Hội đồng nhân dân (HĐND) các cấp: Nghị quyết.
   - Ủy ban nhân dân (UBND) các cấp: Quyết định.
   - Chủ tịch UBND cấp tỉnh: Quyết định.
   - Chính quyền địa phương ở đơn vị hành chính - kinh tế đặc biệt: Văn bản quy phạm pháp luật.
5. ĐỊNH DẠNG XUẤT DUY NHẤT:
   Dòng 1: 👉 ĐÁP ÁN: [Chữ cái A, B, C hoặc D] - [Nội dung đầy đủ của đáp án đúng]
   Dòng 2: 💡 Căn cứ: [1-2 câu ngắn gọn giải thích chính xác định lý, luật/điều khoản hoặc quy tắc chứng minh đáp án trên là đúng 100%].

TUYỆT ĐỐI: Không viết lời chào hỏi, không lặp lại đề bài.`,
    maxTokens: 512
  };
}

// Tự động khôi phục nếu key DeepSeek từng bị lưu nhầm vào ô OpenAI
function normalizeStorageKeys(storage) {
  const s = { ...storage };
  if (isDeepSeekKeyFormat(s.openaiApiKey) && !s.deepseekApiKey) {
    s.deepseekApiKey = s.openaiApiKey.trim();
  }
  return s;
}

// ==========================================
// XỬ LÝ YÊU CẦU GIẢI BÀI TỪ CONTENT SCRIPT
// ==========================================
async function handleAIRequest(questionText) {
  const rawStorage = await chrome.storage.local.get([
    "aiProvider",
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

  // Nếu đang chọn chatgpt nhưng key bên trong lại là định dạng DeepSeek (sk- + 32 hex)
  if (preferredProvider === "chatgpt" && isDeepSeekKeyFormat(storage.openaiApiKey)) {
    preferredProvider = "deepseek";
  }

  const solveMode = storage.solveMode || "balanced";
  const { systemInstruction, maxTokens } = buildSystemInstruction(solveMode);

  const callers = {
    gemini: () => callGemini(questionText, storage, systemInstruction, maxTokens),
    deepseek: () => callDeepSeek(questionText, storage, systemInstruction, maxTokens),
    chatgpt: () => callOpenAI(questionText, storage, systemInstruction, maxTokens),
    groq: () => callGroq(questionText, storage, systemInstruction, maxTokens),
    openrouter: () => callOpenRouter(questionText, storage, systemInstruction, maxTokens)
  };

  const hasKey = {
    gemini: !!(storage.geminiApiKey && storage.geminiApiKey.trim()),
    deepseek: !!(storage.deepseekApiKey && storage.deepseekApiKey.trim()),
    chatgpt: !!(storage.openaiApiKey && storage.openaiApiKey.trim() && !isDeepSeekKeyFormat(storage.openaiApiKey)),
    groq: !!(storage.groqApiKey && storage.groqApiKey.trim()),
    openrouter: !!(storage.openrouterApiKey && storage.openrouterApiKey.trim())
  };

  if (!hasKey.gemini && !hasKey.deepseek && !hasKey.chatgpt && !hasKey.groq && !hasKey.openrouter) {
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

  throw lastError || new Error("Không thể kết nối tới AI. Vui lòng kiểm tra lại API Key!");
}

// ==========================================
// 1. DEEPSEEK API CHÍNH THỨC (api.deepseek.com - DeepSeek V3 & R1)
// ==========================================
async function callDeepSeek(questionText, storage, systemInstruction, maxTokens) {
  const apiKey = storage.deepseekApiKey || (isDeepSeekKeyFormat(storage.openaiApiKey) ? storage.openaiApiKey : "");
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Chưa có DeepSeek API Key! Hãy nhập key DeepSeek (sk-...) hoặc dùng DeepSeek miễn phí qua tab OpenRouter.");
  }

  const cleanKey = apiKey.trim();

  // Nếu người dùng dán key OpenRouter (sk-or-v1-...) vào ô DeepSeek, tự động gọi qua OpenRouter với model DeepSeek!
  if (cleanKey.startsWith("sk-or-")) {
    return callOpenRouter(
      questionText,
      {
        ...storage,
        openrouterApiKey: cleanKey,
        openrouterModel: "deepseek/deepseek-chat-v3-0324:free"
      },
      systemInstruction,
      maxTokens
    );
  }

  const preferredModel = storage.deepseekModel || "deepseek-chat";
  const candidateModels = [preferredModel, "deepseek-chat", "deepseek-reasoner"].filter(
    (v, i, a) => v && a.indexOf(v) === i
  );

  const url = "https://api.deepseek.com/chat/completions";
  let lastError = null;

  for (const model of candidateModels) {
    try {
      const isReasoner = model === "deepseek-reasoner";
      const payload = {
        model,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: `Đọc kỹ và giải câu hỏi sau:\n${questionText}` }
        ],
        max_tokens: isReasoner ? Math.max(maxTokens || 1024, 1024) : Math.max(maxTokens || 350, 350)
      };

      if (!isReasoner) {
        payload.temperature = 0.0;
      }

      const response = await fetch(url, {
        method: "POST",
        signal: AbortSignal.timeout(15000),
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
          throw new Error("DeepSeek API Key không hợp lệ! Hãy kiểm tra lại mã key tại platform.deepseek.com.");
        }
        if (response.status === 402 || errMsg.toLowerCase().includes("insufficient balance")) {
          throw new Error(
            "Tài khoản DeepSeek (platform.deepseek.com) của bạn hiện có số dư 0$ (Insufficient Balance - lỗi 402). 💡 MẸO DÙNG DEEPSEEK MIỄN PHÍ: Hãy chuyển sang tab '🆓 OpenRouter' → tạo key miễn phí tại openrouter.ai/keys (không cần nạp tiền) và chọn model 'DeepSeek V3 0324 (FREE)'!"
          );
        }
        lastError = new Error(`DeepSeek (${response.status}): ${errMsg}`);
        continue;
      }

      const content = data?.choices?.[0]?.message?.content;
      if (content && content.trim()) {
        return {
          text: cleanThinkTags(content),
          provider: "DeepSeek",
          model
        };
      }
    } catch (err) {
      if (
        err.message &&
        (err.message.includes("không hợp lệ") || err.message.includes("Insufficient Balance"))
      ) {
        throw err;
      }
      lastError = err;
    }
  }

  throw lastError || new Error("DeepSeek không trả về kết quả.");
}

// ==========================================
// 2. GOOGLE GEMINI API (HỖ TRỢ GEMINI 2.5 FLASH & 2.0 FLASH)
// ==========================================
function isTextGeminiModel(modelName) {
  const m = modelName.toLowerCase();
  const excludedKeywords = [
    "tts",
    "image",
    "embedding",
    "aqa",
    "audio",
    "robotics",
    "computer-use",
    "veo",
    "imagen",
    "learnlm",
    "bisheng",
    "thinking-exp"
  ];
  return !excludedKeywords.some((kw) => m.includes(kw));
}

function extractGeminiText(data) {
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
  const is25Flash = model.includes("2.5-flash");
  const isGen4 = model.startsWith("gemini-4") || model.includes("argon");
  const isGen3 = model.startsWith("gemini-3");

  const generationConfig = {
    temperature: 0.0,
    maxOutputTokens: Math.max(maxTokens || 1024, 1024)
  };
  if (isGen4 || isGen3) {
    generationConfig.thinkingConfig = { thinkingLevel: "low" };
  } else if (is25Flash) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

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
    signal: AbortSignal.timeout(12000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  let data = await response.json().catch(() => ({}));

  if (!response.ok && response.status === 400 && is25Flash) {
    delete payload.generationConfig.thinkingConfig;
    payload.generationConfig.maxOutputTokens = Math.max(maxTokens || 1024, 1024);
    response = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(12000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    data = await response.json().catch(() => ({}));
  }

  return { response, data };
}

async function callGemini(questionText, storage, systemInstruction, maxTokens) {
  const apiKey = storage.geminiApiKey;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Chưa có Gemini API Key! Hãy mở Extension để nhập key (hoặc đổi sang DeepSeek / Groq / OpenRouter).");
  }

  const cleanKey = apiKey.trim();
  const preferredModel = sanitizeGeminiModel(storage.geminiModel);

  const fallbackModels = [
    preferredModel,
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.1-pro-preview",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
    "gemini-4-argon",
    "gemini-2.5-flash"
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  const promptText = `${systemInstruction}\n\n[ĐỀ BÀI CẦN GIẢI]:\n${questionText}`;
  let lastError = null;

  for (const model of fallbackModels) {
    try {
      const { response, data } = await callGeminiSingleModel(model, cleanKey, promptText, maxTokens);

      if (!response.ok) {
        const reason = data?.error?.details?.[0]?.reason || "";
        const errMsg = data?.error?.message || `HTTP ${response.status}`;

        if (reason === "API_KEY_SERVICE_BLOCKED") {
          throw new Error(
            "Dự án Google của bạn chưa BẬT Generative Language API! Hãy vào console.cloud.google.com/apis/library/generativelanguage.googleapis.com để bấm Enable, hoặc tạo key mới tại aistudio.google.com/apikey."
          );
        }
        if (reason === "API_KEY_INVALID" || errMsg.toLowerCase().includes("api key not valid")) {
          throw new Error("Gemini API Key không hợp lệ! Hãy kiểm tra lại mã key (bắt đầu bằng AIzaSy...).");
        }

        console.warn(`[Gemini] Model ${model} trả về ${response.status}: ${errMsg}. Đang thử model tiếp theo...`);
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
      if (
        error.message &&
        (error.message.includes("Generative Language API") || error.message.includes("không hợp lệ"))
      ) {
        throw error;
      }
      lastError = error;
    }
  }

  // Tự động truy vấn danh sách model thực tế từ Google API nếu các model mặc định đều lỗi
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

  throw lastError || new Error("Không thể kết nối Google Gemini. Vui lòng kiểm tra API Key hoặc đổi sang DeepSeek/Groq/OpenRouter.");
}

// ==========================================
// 3. GROQ AI (LLAMA 3.3 / LLAMA 3.1 - SIÊU TỐC ĐỘ + TỰ ĐỘNG DÒ MODEL SỐNG)
// ==========================================
async function fetchLiveGroqChatModels(cleanKey) {
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
      "whisper",
      "tts",
      "playai",
      "guard",
      "orpheus",
      "embed",
      "vision",
      "qwen3-32b"
    ];
    return list
      .map((m) => m.id)
      .filter(
        (id) =>
          id &&
          !ignoreKeywords.some((kw) => id.toLowerCase().includes(kw))
      );
  } catch (_) {
    return [];
  }
}

async function callGroq(questionText, storage, systemInstruction, maxTokens) {
  const apiKey = storage.groqApiKey;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Chưa có Groq API Key! Hãy mở Extension để nhập key Groq (bắt đầu bằng gsk_...).");
  }

  const cleanKey = apiKey.trim();

  // Nếu người dùng dán nhầm key của hãng khác vào ô Groq, tự động chuyển đúng hãng!
  if (cleanKey.startsWith("AIza")) {
    return callGemini(questionText, { ...storage, geminiApiKey: cleanKey }, systemInstruction, maxTokens);
  }
  if (cleanKey.startsWith("sk-or-")) {
    return callOpenRouter(questionText, { ...storage, openrouterApiKey: cleanKey }, systemInstruction, maxTokens);
  }
  if (isDeepSeekKeyFormat(cleanKey)) {
    return callDeepSeek(questionText, { ...storage, deepseekApiKey: cleanKey }, systemInstruction, maxTokens);
  }
  if (cleanKey.startsWith("sk-proj-")) {
    return callOpenAI(questionText, { ...storage, openaiApiKey: cleanKey }, systemInstruction, maxTokens);
  }

  const preferredModel = sanitizeGroqModel(storage.groqModel);
  // Ưu tiên tuyệt đối các model lớn thông minh (70B / DeepSeek R1 70B / Llama 4 109B MoE), đẩy 8B xuống cuối cùng!
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
          max_tokens: Math.max(maxTokens || 750, 750)
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

        // Nếu model 70B bị giới hạn tốc độ tức thời (429) khi giải 20 câu liên tiếp, nghỉ 1.2s rồi thử lại chính model 70B đó trước khi hạ xuống model nhỏ!
        if (response.status === 429) {
          await new Promise((r) => setTimeout(r, 1200));
          if (model === "llama-3.3-70b-versatile" && !retried70B) {
            retried70B = true;
            i--;
            continue;
          }
        }

        // Nếu báo 404 (Model không tồn tại hoặc tài khoản chưa bật model đó), tự động lấy danh sách model thực tế của tài khoản Groq này!
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

// ==========================================
// 4. OPENROUTER (MIỄN PHÍ - DEEPSEEK V3, R1, GEMMA 3, LLAMA 3.3)
// ==========================================
async function callOpenRouter(questionText, storage, systemInstruction, maxTokens) {
  const apiKey = storage.openrouterApiKey;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Chưa có OpenRouter API Key! Vào openrouter.ai/keys để tạo key miễn phí (sk-or-v1-...).");
  }

  const cleanKey = apiKey.trim();

  // Nếu người dùng dán key DeepSeek (sk- + 32 hex) vào ô OpenRouter, tự động chuyển sang gọi DeepSeek API
  if (isDeepSeekKeyFormat(cleanKey)) {
    return callDeepSeek(
      questionText,
      { ...storage, deepseekApiKey: cleanKey },
      systemInstruction,
      maxTokens
    );
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
        signal: AbortSignal.timeout(14000),
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
          max_tokens: Math.max(maxTokens || 350, 350)
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.error) {
        const errMsg = data?.error?.message || `HTTP ${response.status}`;
        if (response.status === 401) {
          throw new Error("OpenRouter API Key không hợp lệ! Hãy lấy key mới tại openrouter.ai/keys (dạng sk-or-v1-...).");
        }
        console.warn(`[OpenRouter] Model ${model} lỗi (${response.status}): ${errMsg}. Thử model kế tiếp...`);
        lastError = new Error(`OpenRouter (${response.status}): ${errMsg}`);
        continue;
      }

      const content = data?.choices?.[0]?.message?.content;
      if (content && content.trim()) {
        return {
          text: cleanThinkTags(content),
          provider: "OpenRouter",
          model: model
        };
      }
    } catch (err) {
      if (err.message && err.message.includes("không hợp lệ")) throw err;
      lastError = err;
    }
  }

  throw lastError || new Error("OpenRouter không trả về kết quả.");
}

// ==========================================
// 5. OPENAI CHATGPT API (GPT-4O-MINI / GPT-4.1-MINI / GPT-4O / O3-MINI)
// ==========================================
async function callOpenAI(questionText, storage, systemInstruction, maxTokens) {
  const apiKey = storage.openaiApiKey;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Chưa có OpenAI API Key! Hãy mở Extension để nhập key OpenAI (dạng sk-proj-...).");
  }

  const cleanKey = apiKey.trim();

  // Nếu key trong ô OpenAI thực chất là key DeepSeek (sk- + 32 ký tự hex), tự động gọi DeepSeek API!
  if (isDeepSeekKeyFormat(cleanKey)) {
    return callDeepSeek(
      questionText,
      { ...storage, deepseekApiKey: cleanKey },
      systemInstruction,
      maxTokens
    );
  }

  const preferredModel = storage.openaiModel || "gpt-4o-mini";
  const candidateModels = [preferredModel, "gpt-4o-mini", "gpt-4.1-mini", "gpt-4o"].filter(
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
        payload.max_tokens = Math.max(maxTokens || 350, 350);
      }

      const response = await fetch(url, {
        method: "POST",
        signal: AbortSignal.timeout(12000),
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
          throw new Error(
            "Tài khoản OpenAI của bạn đã hết số dư/credits ($0 balance)! Bạn cần nạp tiền vào Billing (platform.openai.com) hoặc chuyển sang dùng Groq / Gemini (Miễn phí 100%)."
          );
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
      if (
        err.message &&
        (err.message.includes("không hợp lệ") ||
          err.message.includes("hết số dư") ||
          err.message.includes("Insufficient Quota"))
      ) {
        throw err;
      }
      lastError = err;
    }
  }

  throw lastError || new Error("ChatGPT không trả về kết quả.");
}

// ==========================================
// 6. KIỂM TRA KẾT NỐI API
// ==========================================
async function testApiConnection(req) {
  const stored = await chrome.storage.local.get([
    "aiProvider",
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
  const tempStorage = {
    ...stored,
    aiProvider: provider
  };

  if (provider === "gemini") {
    if (req.apiKey !== undefined) tempStorage.geminiApiKey = req.apiKey;
    if (req.model !== undefined) tempStorage.geminiModel = req.model;
  } else if (provider === "deepseek") {
    if (req.apiKey !== undefined) tempStorage.deepseekApiKey = req.apiKey;
    if (req.model !== undefined) tempStorage.deepseekModel = req.model;
  } else if (provider === "chatgpt") {
    if (req.apiKey !== undefined) tempStorage.openaiApiKey = req.apiKey;
    if (req.model !== undefined) tempStorage.openaiModel = req.model;
    if (isDeepSeekKeyFormat(tempStorage.openaiApiKey)) {
      provider = "deepseek";
      tempStorage.deepseekApiKey = tempStorage.openaiApiKey;
      tempStorage.deepseekModel = "deepseek-chat";
    }
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
  if (provider === "gemini") {
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
    sampleReply: result.text,
    latencyMs
  };
}

// ==========================================
// 7. CHỤP MÀN HÌNH & GIẢI ĐỀ BẰNG AI VISION (DÙNG KHI ĐỀ THI LÀ ẢNH / CANVAS / CHẶN DOM)
// ==========================================
async function handleCaptureAndSolve(request = {}, windowId = null) {
  const rawStorage = await chrome.storage.local.get([
    "aiProvider",
    "geminiApiKey",
    "deepseekApiKey",
    "openaiApiKey",
    "groqApiKey",
    "openrouterApiKey",
    "solveMode"
  ]);
  const storage = normalizeStorageKeys(rawStorage);
  const preferred = storage.aiProvider || "gemini";
  const canvasText = (request?.canvasText || "").trim();

  // Nếu trang vẽ đề bằng Canvas và đã bắt được chữ ngầm, và người dùng đang dùng DeepSeek (hoặc model chỉ xử lý text), giải ngay lập tức!
  if (canvasText.length >= 10 && preferred === "deepseek") {
    const res = await handleAIRequest(canvasText);
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
        chrome.tabs.captureVisibleTab(
          null,
          { format: "jpeg", quality: 82 },
          (imgUrl) => {
            if (chrome.runtime.lastError || !imgUrl) {
              reject(
                new Error(
                  chrome.runtime.lastError?.message || "Không thể chụp màn hình trang thi."
                )
              );
            } else {
              resolve(imgUrl);
            }
          }
        );
      });
    } catch (captureErr) {
      if (canvasText.length >= 10) {
        const res = await handleAIRequest(canvasText);
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

  const { systemInstruction, maxTokens } = buildSystemInstruction(
    storage.solveMode || "balanced"
  );
  const visionPrompt = `${systemInstruction}\n\nHãy đọc câu hỏi trắc nghiệm trong hình chụp màn hình này và đưa ra đáp án chính xác nhất theo đúng định dạng yêu cầu.`;
  const visionCallers = {
    gemini: async () => {
      const key = storage.geminiApiKey?.trim();
      if (!key) throw new Error("No Gemini key");
      for (const m of ["gemini-2.5-flash", "gemini-2.0-flash"]) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`;
        const res = await fetch(url, {
          method: "POST",
          signal: AbortSignal.timeout(15000),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: visionPrompt },
                  { inline_data: { mime_type: "image/jpeg", data: base64Data } }
                ]
              }
            ],
            generationConfig: { temperature: 0.0, maxOutputTokens: Math.max(maxTokens, 512) }
          })
        });
        const data = await res.json().catch(() => ({}));
        const text = extractGeminiText(data);
        if (res.ok && text) return { text, provider: "Gemini Vision", model: m };
      }
      throw new Error("Gemini Vision không phản hồi.");
    },
    groq: async () => {
      const key = storage.groqApiKey?.trim();
      if (!key) throw new Error("No Groq key");
      const m = "meta-llama/llama-4-scout-17b-16e-instruct";
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(14000),
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
      throw new Error(data?.error?.message || "Groq Vision lỗi");
    },
    openrouter: async () => {
      const key = storage.openrouterApiKey?.trim();
      if (!key) throw new Error("No OpenRouter key");
      for (const m of [
        "google/gemma-3-27b-it:free",
        "mistralai/mistral-small-3.1-24b-instruct:free",
        "openrouter/free"
      ]) {
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
      const key = storage.openaiApiKey?.trim();
      if (!key || isDeepSeekKeyFormat(key)) throw new Error("No OpenAI key");
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

  const order = [
    preferred,
    ...Object.keys(visionCallers).filter((k) => k !== preferred)
  ].filter((k) => visionCallers[k]);

  let lastErr = null;
  for (const p of order) {
    try {
      return await visionCallers[p]();
    } catch (e) {
      lastErr = e;
    }
  }

  // Fallback sang giải bằng văn bản trích xuất từ Canvas nếu các API Vision không có key hoặc lỗi
  if (canvasText.length >= 10) {
    const res = await handleAIRequest(canvasText);
    return {
      text: res.text,
      provider: `${res.provider} (Canvas Hook)`,
      model: res.model
    };
  }

  throw (
    lastErr ||
    new Error(
      "Để chụp ảnh giải đề thuần hình ảnh, bạn cần nhập API Key của OpenRouter, Gemini, Groq hoặc ChatGPT."
    )
  );
}

