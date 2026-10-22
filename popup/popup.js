// Popup logic - Wayground AI Settings (Gemini, DeepSeek, ChatGPT, Groq & OpenRouter Turbo)

document.addEventListener("DOMContentLoaded", () => {
  const toggleExtension = document.getElementById("toggleExtension");
  const toggleCopy = document.getElementById("toggleCopy");
  const toggleAutoScroll = document.getElementById("toggleAutoScroll");
  const toggleAutoClick = document.getElementById("toggleAutoClick");
  const toggleStealth = document.getElementById("toggleStealth");
  const orbOpacitySelect = document.getElementById("orbOpacitySelect");
  const solveModeSelect = document.getElementById("solveModeSelect");
  const badgeStatus = document.getElementById("badgeStatus");
  const btnReloadExt = document.getElementById("btnReloadExt");

  // Kiểm tra xem Service Worker nền (background.js) đã ở bản 4.0.0 PRO MAX mới nhất chưa, nếu chưa thì tự động Reload!
  try {
    chrome.runtime.sendMessage({ action: "PING" }, (res) => {
      if (chrome.runtime.lastError || !res || res.version !== "4.0.0") {
        chrome.runtime.reload();
        return;
      }
      if (chrome.tabs && chrome.scripting) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const activeTab = tabs && tabs[0];
          if (activeTab && activeTab.id && activeTab.url && !activeTab.url.startsWith("chrome://")) {
            chrome.scripting
              .executeScript({
                target: { tabId: activeTab.id, allFrames: true },
                files: [
                  "content/inject.js",
                  "content/bypass.js",
                  "content/scanner.js",
                  "content/hud.js",
                  "content/index.js"
                ]
              })
              .catch(() => {});
          }
        });
      }
    });
  } catch (_) {}

  if (btnReloadExt) {
    btnReloadExt.addEventListener("click", () => {
      chrome.runtime.reload();
    });
  }

  // Tabs
  const tabClaude = document.getElementById("tabClaude");
  const tabGemini = document.getElementById("tabGemini");
  const tabDeepSeek = document.getElementById("tabDeepSeek");
  const tabChatGPT = document.getElementById("tabChatGPT");
  const tabGroq = document.getElementById("tabGroq");
  const tabOpenRouter = document.getElementById("tabOpenRouter");

  // Panels
  const claudeSection = document.getElementById("claudeSection");
  const geminiSection = document.getElementById("geminiSection");
  const deepseekSection = document.getElementById("deepseekSection");
  const chatgptSection = document.getElementById("chatgptSection");
  const groqSection = document.getElementById("groqSection");
  const openrouterSection = document.getElementById("openrouterSection");

  // Inputs
  const claudeApiKey = document.getElementById("claudeApiKey");
  const claudeModel = document.getElementById("claudeModel");
  const btnToggleClaudeKey = document.getElementById("btnToggleClaudeKey");

  const geminiApiKey = document.getElementById("geminiApiKey");
  const geminiModel = document.getElementById("geminiModel");
  const btnToggleGeminiKey = document.getElementById("btnToggleGeminiKey");

  const deepseekApiKey = document.getElementById("deepseekApiKey");
  const deepseekModel = document.getElementById("deepseekModel");
  const btnToggleDeepseekKey = document.getElementById("btnToggleDeepseekKey");

  const openaiApiKey = document.getElementById("openaiApiKey");
  const openaiModel = document.getElementById("openaiModel");
  const btnToggleOpenaiKey = document.getElementById("btnToggleOpenaiKey");

  const groqApiKey = document.getElementById("groqApiKey");
  const groqModel = document.getElementById("groqModel");
  const btnToggleGroqKey = document.getElementById("btnToggleGroqKey");

  const openrouterApiKey = document.getElementById("openrouterApiKey");
  const openrouterModel = document.getElementById("openrouterModel");
  const btnToggleOpenrouterKey = document.getElementById("btnToggleOpenrouterKey");

  const btnSave = document.getElementById("btnSave");
  const saveToast = document.getElementById("saveToast");
  const btnTestApi = document.getElementById("btnTestApi");
  const testApiResult = document.getElementById("testApiResult");

  let currentProvider = "gemini";

  const INVALID_MODELS = new Set([
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-3-pro-preview",
    "gemini-3.1-flash-lite-preview",
    "llama-3.1-70b-versatile",
    "gemma2-9b-it",
    "mixtral-8x7b-32768",
    "qwen/qwen3-32b",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "qwen/qwen3.8-27b:free",
    "nvidia/nemotron-3.5-lightning:free"
  ]);

  function isDeepSeekKeyFormat(key) {
    if (!key) return false;
    return /^sk-[0-9a-f]{32}$/i.test(key.trim());
  }

  function setSelectValueSafe(selectEl, value, defaultValue) {
    if (!selectEl) return;
    const cleanVal = value && !INVALID_MODELS.has(value) ? value : defaultValue;

    let found = false;
    for (let i = 0; i < selectEl.options.length; i++) {
      if (selectEl.options[i].value === cleanVal) {
        selectEl.selectedIndex = i;
        found = true;
        break;
      }
    }

    if (!found && cleanVal) {
      const opt = document.createElement("option");
      opt.value = cleanVal;
      opt.textContent = `🚀 ${cleanVal}`;
      opt.selected = true;
      selectEl.prepend(opt);
    }
  }

  // Chuyển Tab và lưu ngay
  if (tabClaude) {
    tabClaude.addEventListener("click", () => {
      switchProvider("claude");
      saveSettings(false);
    });
  }
  if (tabGemini) {
    tabGemini.addEventListener("click", () => {
      switchProvider("gemini");
      saveSettings(false);
    });
  }
  if (tabDeepSeek) {
    tabDeepSeek.addEventListener("click", () => {
      switchProvider("deepseek");
      saveSettings(false);
    });
  }
  if (tabChatGPT) {
    tabChatGPT.addEventListener("click", () => {
      switchProvider("chatgpt");
      saveSettings(false);
    });
  }
  if (tabGroq) {
    tabGroq.addEventListener("click", () => {
      switchProvider("groq");
      saveSettings(false);
    });
  }
  if (tabOpenRouter) {
    tabOpenRouter.addEventListener("click", () => {
      switchProvider("openrouter");
      saveSettings(false);
    });
  }

  function switchProvider(provider) {
    currentProvider = provider;
    [tabClaude, tabGemini, tabDeepSeek, tabChatGPT, tabGroq, tabOpenRouter].forEach(
      (t) => t && t.classList.remove("active")
    );
    [claudeSection, geminiSection, deepseekSection, chatgptSection, groqSection, openrouterSection].forEach(
      (s) => s && (s.style.display = "none")
    );

    if (provider === "claude") {
      if (tabClaude) tabClaude.classList.add("active");
      if (claudeSection) claudeSection.style.display = "flex";
    } else if (provider === "gemini") {
      if (tabGemini) tabGemini.classList.add("active");
      if (geminiSection) geminiSection.style.display = "flex";
    } else if (provider === "deepseek") {
      if (tabDeepSeek) tabDeepSeek.classList.add("active");
      if (deepseekSection) deepseekSection.style.display = "flex";
    } else if (provider === "chatgpt") {
      if (tabChatGPT) tabChatGPT.classList.add("active");
      if (chatgptSection) chatgptSection.style.display = "flex";
    } else if (provider === "groq") {
      if (tabGroq) tabGroq.classList.add("active");
      if (groqSection) groqSection.style.display = "flex";
    } else if (provider === "openrouter") {
      if (tabOpenRouter) tabOpenRouter.classList.add("active");
      if (openrouterSection) openrouterSection.style.display = "flex";
    }
  }

  // Load cài đặt đã lưu
  chrome.storage.local.get(
    [
      "extensionEnabled",
      "unblockCopyEnabled",
      "autoScrollSolveEnabled",
      "autoClickEnabled",
      "stealthMode",
      "orbOpacityPresetIdx",
      "solveMode",
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
    ],
    (res) => {
      toggleExtension.checked = res.extensionEnabled !== false;
      toggleCopy.checked = res.unblockCopyEnabled !== false;
      if (toggleAutoScroll) toggleAutoScroll.checked = res.autoScrollSolveEnabled !== false;
      if (toggleAutoClick) toggleAutoClick.checked = res.autoClickEnabled === true;
      toggleStealth.checked = res.stealthMode === true;
      if (typeof res.orbOpacityPresetIdx === "number" && orbOpacitySelect) {
        orbOpacitySelect.value = String(res.orbOpacityPresetIdx);
      }
      if (res.solveMode) solveModeSelect.value = res.solveMode;

      if (res.claudeApiKey && claudeApiKey) claudeApiKey.value = res.claudeApiKey;
      setSelectValueSafe(claudeModel, res.claudeModel, "claude-3-7-sonnet-latest");

      if (res.geminiApiKey) geminiApiKey.value = res.geminiApiKey;
      setSelectValueSafe(geminiModel, res.geminiModel, "gemini-3.5-flash-lite");

      if (res.deepseekApiKey && deepseekApiKey) {
        deepseekApiKey.value = res.deepseekApiKey;
      }
      setSelectValueSafe(deepseekModel, res.deepseekModel, "deepseek-chat");

      // Nếu trước đó key DeepSeek (sk- + 32 hex) bị nhảy nhầm vào ô OpenAI, tự động chuyển về đúng tab DeepSeek!
      let targetProvider = res.aiProvider || "gemini";
      if (isDeepSeekKeyFormat(res.openaiApiKey)) {
        if (deepseekApiKey && !deepseekApiKey.value) {
          deepseekApiKey.value = res.openaiApiKey.trim();
        }
        openaiApiKey.value = "";
        if (targetProvider === "chatgpt") {
          targetProvider = "deepseek";
        }
      } else if (res.openaiApiKey) {
        openaiApiKey.value = res.openaiApiKey;
      }
      setSelectValueSafe(openaiModel, res.openaiModel, "gpt-4o-mini");

      if (res.groqApiKey && groqApiKey) groqApiKey.value = res.groqApiKey;
      setSelectValueSafe(groqModel, res.groqModel, "llama-3.3-70b-versatile");

      if (res.openrouterApiKey && openrouterApiKey) openrouterApiKey.value = res.openrouterApiKey;
      setSelectValueSafe(
        openrouterModel,
        res.openrouterModel,
        "deepseek/deepseek-chat-v3-0324:free"
      );

      switchProvider(targetProvider);
      updateStatusUI(toggleExtension.checked);
      saveSettings(false);
    }
  );

  function updateStatusUI(isActive) {
    if (isActive) {
      badgeStatus.textContent = "ĐÃ KÍCH HOẠT";
      badgeStatus.classList.remove("inactive");
    } else {
      badgeStatus.textContent = "ĐANG TẮT";
      badgeStatus.classList.add("inactive");
    }
  }

  // Ẩn/hiện key
  if (btnToggleClaudeKey) {
    btnToggleClaudeKey.addEventListener("click", () =>
      toggleVisibility(claudeApiKey, btnToggleClaudeKey)
    );
  }
  if (btnToggleGeminiKey) {
    btnToggleGeminiKey.addEventListener("click", () =>
      toggleVisibility(geminiApiKey, btnToggleGeminiKey)
    );
  }
  if (btnToggleDeepseekKey) {
    btnToggleDeepseekKey.addEventListener("click", () =>
      toggleVisibility(deepseekApiKey, btnToggleDeepseekKey)
    );
  }
  if (btnToggleOpenaiKey) {
    btnToggleOpenaiKey.addEventListener("click", () =>
      toggleVisibility(openaiApiKey, btnToggleOpenaiKey)
    );
  }
  if (btnToggleGroqKey) {
    btnToggleGroqKey.addEventListener("click", () =>
      toggleVisibility(groqApiKey, btnToggleGroqKey)
    );
  }
  if (btnToggleOpenrouterKey) {
    btnToggleOpenrouterKey.addEventListener("click", () =>
      toggleVisibility(openrouterApiKey, btnToggleOpenrouterKey)
    );
  }

  function toggleVisibility(inputEl, btnEl) {
    if (inputEl.type === "password") {
      inputEl.type = "text";
      btnEl.textContent = "🙈";
    } else {
      inputEl.type = "password";
      btnEl.textContent = "👁️";
    }
  }

  // Nhận diện thông minh khi dán key
  function handleSmartKeyPaste(inputEl) {
    const val = inputEl.value.trim();
    if (!val) {
      saveSettings(false);
      return;
    }

    if (val.startsWith("sk-ant-") && currentProvider !== "claude") {
      claudeApiKey.value = val;
      if (inputEl !== claudeApiKey) inputEl.value = "";
      switchProvider("claude");
    } else if (val.startsWith("AIza") && currentProvider !== "gemini") {
      geminiApiKey.value = val;
      if (inputEl !== geminiApiKey) inputEl.value = "";
      switchProvider("gemini");
    } else if (val.startsWith("gsk_") && currentProvider !== "groq") {
      groqApiKey.value = val;
      if (inputEl !== groqApiKey) inputEl.value = "";
      switchProvider("groq");
    } else if (val.startsWith("sk-or-") && currentProvider !== "openrouter") {
      openrouterApiKey.value = val;
      if (inputEl !== openrouterApiKey) inputEl.value = "";
      switchProvider("openrouter");
    } else if (isDeepSeekKeyFormat(val) && currentProvider !== "deepseek") {
      deepseekApiKey.value = val;
      if (inputEl !== deepseekApiKey) inputEl.value = "";
      switchProvider("deepseek");
    } else if (val.startsWith("sk-proj-") && currentProvider !== "chatgpt") {
      openaiApiKey.value = val;
      if (inputEl !== openaiApiKey) inputEl.value = "";
      switchProvider("chatgpt");
    }

    saveSettings(false);
  }

  [claudeApiKey, geminiApiKey, deepseekApiKey, openaiApiKey, groqApiKey, openrouterApiKey].forEach((inputEl) => {
    if (!inputEl) return;
    inputEl.addEventListener("input", () => handleSmartKeyPaste(inputEl));
    inputEl.addEventListener("change", () => handleSmartKeyPaste(inputEl));
  });

  [claudeModel, geminiModel, deepseekModel, openaiModel, groqModel, openrouterModel].forEach((selectEl) => {
    if (!selectEl) return;
    selectEl.addEventListener("change", () => saveSettings(false));
  });

  toggleExtension.addEventListener("change", () => {
    updateStatusUI(toggleExtension.checked);
    saveSettings(false);
  });
  toggleCopy.addEventListener("change", () => saveSettings(false));
  if (toggleAutoScroll) toggleAutoScroll.addEventListener("change", () => saveSettings(false));
  if (toggleAutoClick) toggleAutoClick.addEventListener("change", () => saveSettings(false));
  toggleStealth.addEventListener("change", () => saveSettings(false));
  if (orbOpacitySelect) orbOpacitySelect.addEventListener("change", () => saveSettings(false));
  solveModeSelect.addEventListener("change", () => saveSettings(false));

  // ==========================================
  // NÚT KIỂM TRA KẾT NỐI API
  // ==========================================
  btnTestApi.addEventListener("click", () => {
    let apiKey = "";
    let model = "";
    let providerName = "";

    if (currentProvider === "claude") {
      apiKey = claudeApiKey.value.trim();
      model = claudeModel.value;
      providerName = "Anthropic Claude";
    } else if (currentProvider === "deepseek") {
      apiKey = deepseekApiKey.value.trim();
      model = deepseekModel.value;
      providerName = "DeepSeek AI";
    } else if (currentProvider === "chatgpt") {
      apiKey = openaiApiKey.value.trim();
      model = openaiModel.value;
      providerName = "OpenAI ChatGPT";
    } else if (currentProvider === "groq") {
      apiKey = groqApiKey.value.trim();
      model = groqModel.value;
      providerName = "Groq AI";
    } else if (currentProvider === "openrouter") {
      apiKey = openrouterApiKey.value.trim();
      model = openrouterModel.value;
      providerName = "OpenRouter";
    } else {
      apiKey = geminiApiKey.value.trim();
      model = geminiModel.value;
      providerName = "Google Gemini";
    }

    if (!apiKey) {
      testApiResult.style.display = "block";
      testApiResult.className = "test-api-box error";
      testApiResult.textContent = `❌ Bạn chưa nhập API Key cho ${providerName}!`;
      return;
    }

    saveSettings(false);

    testApiResult.style.display = "block";
    testApiResult.className = "test-api-box loading";
    testApiResult.innerHTML = `🔄 Đang kết nối tới <strong>${providerName}</strong> (<code>${model}</code>)...`;
    btnTestApi.disabled = true;

    chrome.runtime.sendMessage(
      {
        action: "TEST_API_CONNECTION",
        provider: currentProvider,
        apiKey: apiKey,
        model: model
      },
      (res) => {
        btnTestApi.disabled = false;

        if (chrome.runtime.lastError) {
          testApiResult.className = "test-api-box error";
          testApiResult.innerHTML = `❌ <strong>Lỗi Service Worker:</strong><br>${chrome.runtime.lastError.message}<br><em>Hãy vào chrome://extensions bấm nút Reload (🔄) tiện ích.</em>`;
          return;
        }

        if (res && res.success) {
          const latencySec = (res.latencyMs / 1000).toFixed(2);
          testApiResult.className = "test-api-box success";
          let note = "";
          const reqM = res.requestedModel || model;
          if (reqM && res.model && res.model !== reqM) {
            note = `<div style="margin-top:8px; font-size:11px; color:#fde68a; background:rgba(245,158,11,0.18); border:1px solid rgba(245,158,11,0.4); padding:6px 8px; border-radius:4px; text-align:left; line-height:1.45;">
              💡 <strong>Tại sao phản hồi bằng <code>${res.model}</code>?</strong><br>
              Model <code>${reqM}</code> của Google là mô hình cấp cao (yêu cầu dự án có thẻ thanh toán / Billing). Vì API Key của bạn là <strong>bản miễn phí (Free Tier)</strong>, cơ chế chống chết bài thi của tiện ích đã <strong>tự động chuyển sang model dự phòng <code>${res.model}</code></strong> để bạn làm bài mượt mà 10/10 mà không bị lỗi đơ!
            </div>`;
          }
          testApiResult.innerHTML = `✅ <strong>Kết nối ${res.provider} thành công 100%!</strong><br>• Model đang dùng: <code>${res.model}</code><br>• Tốc độ phản hồi: <strong>${latencySec}s</strong><br>• Phản hồi thử: <em>"${res.sampleReply || "OK"}"</em>${note}`;
        } else {
          testApiResult.className = "test-api-box error";
          testApiResult.innerHTML = `❌ <strong>Kết nối thất bại:</strong><br>${res?.error || "Không thể kết nối API"}`;
        }
      }
    );
  });

  // Nút Lưu cài đặt
  btnSave.addEventListener("click", () => saveSettings(true));

  function saveSettings(showFeedback = true) {
    const config = {
      extensionEnabled: toggleExtension.checked,
      unblockCopyEnabled: toggleCopy.checked,
      autoScrollSolveEnabled: toggleAutoScroll ? toggleAutoScroll.checked : false,
      autoClickEnabled: toggleAutoClick ? toggleAutoClick.checked : false,
      stealthMode: toggleStealth.checked,
      orbOpacityPresetIdx: orbOpacitySelect ? parseInt(orbOpacitySelect.value, 10) : 0,
      solveMode: solveModeSelect.value,
      aiProvider: currentProvider,
      claudeApiKey: claudeApiKey ? claudeApiKey.value.trim() : "",
      claudeModel: claudeModel ? claudeModel.value : "claude-3-7-sonnet-latest",
      geminiApiKey: geminiApiKey ? geminiApiKey.value.trim() : "",
      geminiModel: geminiModel ? geminiModel.value : "gemini-3.5-flash-lite",
      deepseekApiKey: deepseekApiKey ? deepseekApiKey.value.trim() : "",
      deepseekModel: deepseekModel ? deepseekModel.value : "deepseek-chat",
      openaiApiKey: openaiApiKey ? openaiApiKey.value.trim() : "",
      openaiModel: openaiModel ? openaiModel.value : "gpt-4o-mini",
      groqApiKey: groqApiKey ? groqApiKey.value.trim() : "",
      groqModel: groqModel ? groqModel.value : "llama-3.3-70b-versatile",
      openrouterApiKey: openrouterApiKey ? openrouterApiKey.value.trim() : "",
      openrouterModel: openrouterModel ? openrouterModel.value : "deepseek/deepseek-chat-v3-0324:free"
    };

    chrome.storage.local.set(config, () => {
      if (showFeedback) {
        saveToast.style.display = "block";
        setTimeout(() => {
          saveToast.style.display = "none";
        }, 2200);
      }
    });
  }
});
