// Content Script - Wayground AI Stealth Assistant
// Hỗ trợ: Mở khóa bôi đen 100%, Tự bắt chữ vừa bôi đen, Chế độ Chỉ chuột chọn câu, Quét danh sách [Câu 1..N], Chụp ảnh Vision & Chống phát hiện thoát Fullscreen
(function () {
  "use strict";

  let isEnabled = true;
  let unblockCopyEnabled = true;
  let stealthMode = false;
  let widgetVisible = false;
  let isMiniMode = false;
  let isPickQuestionMode = false;
  let currentOpacityIndex = 0;
  const opacityLevels = [1.0, 0.45, 0.2];

  let shadowRoot = null;
  let widgetContainer = null;
  let lastHoveredElement = null;
  let lastSelectedText = "";
  let scannedQuestionsList = [];

  const isTopFrame = window === window.top;

  // Danh sách Model cho từng Provider ngay trong HUD (để đổi nhanh khi đang Full màn hình)
  const PROVIDER_MODELS = {
    openrouter: [
      { value: "deepseek/deepseek-chat-v3-0324:free", label: "🧠 DeepSeek V3 0324 (FREE)" },
      { value: "deepseek/deepseek-r1:free", label: "🐳 DeepSeek R1 (FREE)" },
      { value: "openrouter/free", label: "🚀 Auto Free Router (Tự chọn model sống)" },
      { value: "meta-llama/llama-3.3-70b-instruct:free", label: "🔥 Llama 3.3 70B (FREE)" },
      { value: "google/gemma-3-27b-it:free", label: "⚡ Gemma 3 27B IT (FREE)" },
      { value: "qwen/qwen-2.5-72b-instruct:free", label: "💡 Qwen 2.5 72B (FREE)" },
      { value: "mistralai/mistral-small-3.1-24b-instruct:free", label: "✨ Mistral Small 3.1 (FREE)" }
    ],
    groq: [
      { value: "llama-3.3-70b-versatile", label: "🧠 Llama 3.3 70B (Mạnh nhất - Chuẩn 10/10)" },
      { value: "deepseek-r1-distill-llama-70b", label: "🐳 DeepSeek R1 70B (Tư duy Toán/Lý/Hóa)" },
      { value: "meta-llama/llama-4-scout-17b-16e-instruct", label: "🚀 Llama 4 Scout (Llama 4 MoE)" },
      { value: "llama-3.1-8b-instant", label: "⚡ Llama 3.1 8B (Siêu tốc 0.1s)" }
    ],
    gemini: [
      { value: "gemini-2.5-flash", label: "🚀 Gemini 2.5 Flash (Nhanh & Chuẩn)" },
      { value: "gemini-2.0-flash", label: "⚡ Gemini 2.0 Flash (Ổn định ~0.5s)" },
      { value: "gemini-2.0-flash-lite", label: "💨 Gemini 2.0 Flash Lite (Siêu nhẹ)" },
      { value: "gemini-2.5-flash-lite", label: "✨ Gemini 2.5 Flash Lite (Tiết kiệm)" },
      { value: "gemini-2.5-pro", label: "🧠 Gemini 2.5 Pro (Toán/Lý/Hóa khó)" }
    ],
    deepseek: [
      { value: "deepseek-chat", label: "🚀 DeepSeek V3 (deepseek-chat)" },
      { value: "deepseek-reasoner", label: "🧠 DeepSeek R1 (deepseek-reasoner)" }
    ],
    chatgpt: [
      { value: "gpt-4o-mini", label: "⚡ GPT-4o Mini (Nhanh & Chuẩn)" },
      { value: "gpt-4.1-mini", label: "🚀 GPT-4.1 Mini (Thế hệ mới)" },
      { value: "gpt-4o", label: "🔥 GPT-4o (Toàn diện)" },
      { value: "o3-mini", label: "🧠 o3-mini (Tư duy STEM)" }
    ]
  };

  // Xuyên qua các lớp màng chắn (watermark / overlay chống copy) để lấy đúng phần tử câu hỏi bên dưới
  function getDeepElementAtPoint(x, y) {
    try {
      const els = document.elementsFromPoint(x, y);
      for (const el of els) {
        if (widgetContainer && (el === widgetContainer || widgetContainer.contains(el))) continue;
        if (el === document.body || el === document.documentElement) continue;
        if (el.hasAttribute?.("data-wg-ignore") || el.classList?.contains("watermark-shield")) continue;
        const style = window.getComputedStyle(el);
        if (
          style.position === "fixed" &&
          el.offsetWidth > window.innerWidth * 0.85 &&
          el.offsetHeight > window.innerHeight * 0.85 &&
          (el.innerText || "").trim().length < 20
        ) {
          continue;
        }
        return el;
      }
    } catch (_) {}
    return null;
  }

  // 1. Theo dõi phần tử đang trỏ chuột
  window.addEventListener(
    "mousemove",
    (e) => {
      const deepEl = getDeepElementAtPoint(e.clientX, e.clientY) || e.target;
      if (deepEl && deepEl !== widgetContainer) {
        lastHoveredElement = deepEl;
      }
    },
    { passive: true }
  );

  // 2. LIÊN TỤC LƯU LẠI VĂN BẢN VỪA BÔI ĐEN (Để khi bấm vào nút trên HUD không bị mất vùng bôi đen!)
  function captureCurrentSelection() {
    try {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      if (text.length >= 2) {
        lastSelectedText = text;
        if (shadowRoot) {
          const promptInput = shadowRoot.getElementById("promptInput");
          const statusNote = shadowRoot.getElementById("statusNote");
          if (promptInput && document.activeElement !== promptInput) {
            promptInput.value = text;
          }
          if (statusNote) {
            statusNote.textContent = "Đã bắt chữ bôi đen! Bấm 🎯 hoặc Alt+Q";
          }
        }
      }
    } catch (_) {}
  }

  document.addEventListener("selectionchange", captureCurrentSelection, { passive: true });
  window.addEventListener("mouseup", () => setTimeout(captureCurrentSelection, 20), { passive: true });

  // Nếu là iframe con, hỗ trợ gửi văn bản bôi đen hoặc câu hỏi dưới trỏ chuột khi bấm Alt+Q lên trang chính
  if (!isTopFrame) {
    window.addEventListener("keydown", (e) => {
      if (e.altKey && (e.key === "q" || e.key === "Q")) {
        let text = window.getSelection().toString().trim() || lastSelectedText;
        if (!text && lastHoveredElement) {
          text = extractQuestionFromElement(lastHoveredElement);
        }
        if (text) {
          e.preventDefault();
          window.top.postMessage({ type: "WAYGROUND_SOLVE_SELECTION", text }, "*");
        }
      }
    });
  } else {
    window.addEventListener("message", (e) => {
      if (e.data && e.data.type === "WAYGROUND_SOLVE_SELECTION" && e.data.text) {
        openWidgetWithText(e.data.text);
      }
    });
  }

  // Khởi tạo khi DOM sẵn sàng hoặc ngay lập tức
  function startExtension() {
    if (!isEnabled) return;
    initAntiCopyAndProctorBypass();
    if (isTopFrame) {
      initUI();
    }
  }

  try {
    chrome.storage.local.get(
      ["extensionEnabled", "unblockCopyEnabled", "stealthMode"],
      (res) => {
        if (chrome.runtime.lastError) return;
        if (res.extensionEnabled !== undefined) isEnabled = res.extensionEnabled;
        if (res.unblockCopyEnabled !== undefined) unblockCopyEnabled = res.unblockCopyEnabled;
        if (res.stealthMode !== undefined) stealthMode = res.stealthMode;

        startExtension();
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", startExtension, { once: true });
        }
        window.addEventListener("load", startExtension, { once: true });
      }
    );
  } catch (e) {}

  // Lắng nghe thay đổi từ Popup
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local") {
        if (changes.extensionEnabled) {
          isEnabled = changes.extensionEnabled.newValue;
          if (isEnabled) {
            startExtension();
          } else {
            removeUI();
          }
        }
        if (changes.unblockCopyEnabled) {
          unblockCopyEnabled = changes.unblockCopyEnabled.newValue;
        }
        if (changes.stealthMode) {
          stealthMode = changes.stealthMode.newValue;
          applyStealthOrbVisibility();
        }
        if (
          changes.aiProvider ||
          changes.geminiModel ||
          changes.deepseekModel ||
          changes.openaiModel ||
          changes.groqModel ||
          changes.openrouterModel
        ) {
          syncHudModelSelectors();
        }
      }
    });

    chrome.runtime.onMessage.addListener((msg) => {
      if (isTopFrame && msg && msg.action === "PROCESS_SELECTION" && msg.text) {
        openWidgetWithText(msg.text);
      }
    });
  } catch (e) {}

  // ==========================================
  // PHẦN 1: MỞ KHÓA BÔI ĐEN 100% & CHỐNG PHÁT HIỆN THOÁT FULLSCREEN / CHUYỂN TAB
  // ==========================================
  let listenersInstalled = false;

  function unlockAttributesAndStyles() {
    if (!unblockCopyEnabled) return;
    const styleId = "wayground-unblock-copy-style";
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        *, *::before, *::after, html, body, div, span, p, a, li, ul, ol, table, tr, td, th, h1, h2, h3, h4, h5, h6, label, input, textarea {
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          -ms-user-select: text !important;
          user-select: text !important;
        }
        .watermark-shield {
          pointer-events: none !important;
        }
      `;
    }
    // Luôn đặt ở cuối head/documentElement để đè lên mọi CSS cấm bôi đen của trang
    const parent = document.head || document.documentElement;
    if (parent && style.parentNode !== parent) {
      parent.appendChild(style);
    }

    // Xóa các thuộc tính inline onselectstart="return false" trên html, body và các thẻ
    const inlineAttrs = ["oncopy", "oncut", "oncontextmenu", "onselectstart", "ondragstart"];
    const targets = [document.documentElement, document.body].filter(Boolean);
    targets.forEach((el) => {
      inlineAttrs.forEach((attr) => {
        try {
          if (el.hasAttribute && el.hasAttribute(attr)) {
            el.removeAttribute(attr);
          }
          el[attr] = null;
        } catch (_) {}
      });
    });
  }

  function initAntiCopyAndProctorBypass() {
    unlockAttributesAndStyles();

    if (!listenersInstalled) {
      listenersInstalled = true;

      // Mỗi khi người dùng nhấn chuột xuống để bôi đen, đảm bảo khóa selectstart đã được gỡ
      window.addEventListener("mousedown", unlockAttributesAndStyles, true);

      const blockCopyEvents = ["copy", "cut", "contextmenu", "selectstart", "dragstart"];
      blockCopyEvents.forEach((evtName) => {
        window.addEventListener(
          evtName,
          (e) => {
            if (unblockCopyEnabled) e.stopImmediatePropagation();
          },
          true
        );
        document.addEventListener(
          evtName,
          (e) => {
            if (unblockCopyEnabled) e.stopImmediatePropagation();
          },
          true
        );
      });

      const proctorEvents = [
        "visibilitychange",
        "webkitvisibilitychange",
        "blur",
        "focusout",
        "mouseleave",
        "pagehide"
      ];
      proctorEvents.forEach((evtName) => {
        window.addEventListener(
          evtName,
          (e) => {
            if (isEnabled) e.stopImmediatePropagation();
          },
          true
        );
        document.addEventListener(
          evtName,
          (e) => {
            if (isEnabled) e.stopImmediatePropagation();
          },
          true
        );
      });

      const fsEvents = [
        "fullscreenchange",
        "webkitfullscreenchange",
        "mozfullscreenchange",
        "MSFullscreenChange"
      ];
      fsEvents.forEach((evtName) => {
        document.addEventListener(
          evtName,
          (e) => {
            if (!isEnabled) return;
            ensureHudInsideFullscreen();
            const fsEl =
              document.fullscreenElement ||
              document.webkitFullscreenElement ||
              document.mozFullScreenElement;
            if (!fsEl) {
              e.stopImmediatePropagation();
            }
          },
          true
        );
      });

      // Chặn phát hiện chụp màn hình bằng phím (PrintScreen, Win+Shift+S, Cmd+Shift+3/4) & ẩn phím tắt Alt của Extension khỏi trang thi
      const shieldKeyEvent = (e) => {
        if (!isEnabled) return;
        const k = (e.key || "").toLowerCase();
        const isPrintScreen =
          e.key === "PrintScreen" || e.code === "PrintScreen" || e.keyCode === 44;
        const isSnippingShortcut =
          e.metaKey && e.shiftKey && (k === "s" || k === "3" || k === "4" || k === "5");
        const isExtensionHotkey =
          e.altKey && (k === "q" || k === "s" || k === "v" || k === "h" || k === "x");

        if (isPrintScreen || isSnippingShortcut) {
          e.stopImmediatePropagation();
        } else if (isExtensionHotkey && e.type === "keyup") {
          e.stopImmediatePropagation();
        }
      };
      window.addEventListener("keydown", shieldKeyEvent, true);
      window.addEventListener("keyup", shieldKeyEvent, true);
      document.addEventListener("keydown", shieldKeyEvent, true);
      document.addEventListener("keyup", shieldKeyEvent, true);
    }

    // Tiêm script vào ngữ cảnh trang (Page Context) để:
    // 1. Vô hiệu hóa Selection.prototype.removeAllRanges() (chống các web xóa vùng bôi đen bằng JS!)
    // 2. Giả lập luôn đang Focus + đang Fullscreen + đang Visible
    try {
      const script = document.createElement("script");
      script.textContent = `
        (function() {
          const clearEvents = ['oncopy', 'oncut', 'oncontextmenu', 'onselectstart', 'ondragstart', 'onblur', 'onfocusout', 'onmouseleave', 'onfullscreenchange', 'onwebkitfullscreenchange', 'onvisibilitychange'];
          clearEvents.forEach(ev => {
            try {
              document[ev] = null;
              window[ev] = null;
              if (document.body) {
                document.body[ev] = null;
                document.body.removeAttribute(ev);
              }
              if (document.documentElement) {
                document.documentElement[ev] = null;
                document.documentElement.removeAttribute(ev);
              }
            } catch(e){}
          });

          if (window.__waygroundAntiProctorInstalled) return;
          window.__waygroundAntiProctorInstalled = true;

          // Chặn đứng trò xóa vùng bôi đen bằng JS: window.getSelection().removeAllRanges() / empty()
          try {
            if (window.Selection && Selection.prototype) {
              Selection.prototype.removeAllRanges = function() {};
              Selection.prototype.empty = function() {};
            }
          } catch(e) {}

          // Bắt tự động mọi văn bản được vẽ lên thẻ <canvas> (Canvas Hook) để đọc đề Canvas 100% chính xác
          try {
            if (window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype) {
              const origFillText = CanvasRenderingContext2D.prototype.fillText;
              const origStrokeText = CanvasRenderingContext2D.prototype.strokeText;
              const recordCanvasText = function(ctx, text) {
                try {
                  if (!ctx || !ctx.canvas || !text) return;
                  const clean = String(text).trim();
                  if (!clean) return;
                  const prev = ctx.canvas.getAttribute('data-wg-canvas-text') || '';
                  const lines = prev ? prev.split('\\n') : [];
                  if (!lines.includes(clean)) {
                    lines.push(clean);
                    ctx.canvas.setAttribute('data-wg-canvas-text', lines.join('\\n'));
                  }
                } catch(_) {}
              };
              CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
                recordCanvasText(this, text);
                return origFillText.apply(this, arguments);
              };
              CanvasRenderingContext2D.prototype.strokeText = function(text, x, y, maxWidth) {
                recordCanvasText(this, text);
                return origStrokeText.apply(this, arguments);
              };
              if (typeof window.drawCanvasQuestion === 'function') {
                window.drawCanvasQuestion();
              }
            }
          } catch(e) {}

          // Luôn báo trạng thái đang mở tab (visible) & đang focus
          try {
            Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
            Object.defineProperty(document, 'webkitHidden', { get: () => false, configurable: true });
            Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
            Object.defineProperty(document, 'webkitVisibilityState', { get: () => 'visible', configurable: true });
            document.hasFocus = function() { return true; };
          } catch(e) {}

          // Giả lập trạng thái Fullscreen nếu trang kiểm tra biến document.fullscreenElement
          try {
            let lastFsEl = null;
            const origFsDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'fullscreenElement') ||
                                     Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
            if (origFsDescriptor && origFsDescriptor.get) {
              Object.defineProperty(document, 'fullscreenElement', {
                get: function() {
                  const real = origFsDescriptor.get.call(this);
                  if (real) { lastFsEl = real; return real; }
                  return lastFsEl || document.documentElement;
                },
                configurable: true
              });
            }
            Object.defineProperty(document, 'fullscreen', { get: () => true, configurable: true });
            Object.defineProperty(document, 'webkitIsFullScreen', { get: () => true, configurable: true });
          } catch(e) {}
        })();
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (e) {}
  }

  function ensureHudInsideFullscreen() {
    if (!widgetContainer) return;
    const fsEl =
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement;
    const targetParent = fsEl || document.documentElement;
    if (targetParent && widgetContainer.parentNode !== targetParent) {
      targetParent.appendChild(widgetContainer);
    }
  }

  // ==========================================
  // PHẦN 2: GIAO DIỆN SHADOW DOM SIÊU NHỎ GỌN & TÀNG HÌNH
  // ==========================================
  function initUI() {
    if (widgetContainer) return;
    if (!document.documentElement) return;

    // Xóa HUD cũ nếu còn tồn tại trên trang trước khi tạo HUD mới
    let wasOldHudOpen = false;
    ["wayground-stealth-hud-root", "wayground-ai-host"].forEach((id) => {
      const oldHost = document.getElementById(id);
      if (oldHost) {
        try {
          if (oldHost.shadowRoot && oldHost.shadowRoot.querySelector(".ai-window.visible")) {
            wasOldHudOpen = true;
          }
        } catch (_) {}
        oldHost.remove();
      }
    });

    widgetContainer = document.createElement("div");
    widgetContainer.id = "wayground-stealth-hud-root";
    widgetContainer.style.all = "initial";
    ensureHudInsideFullscreen();

    shadowRoot = widgetContainer.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }

      /* Khung viền xanh bao quanh câu hỏi khi bật chế độ "👆 Chỉ câu" */
      .pick-highlight-overlay {
        position: fixed;
        pointer-events: none;
        border: 1px solid rgba(148, 163, 184, 0.25);
        background: rgba(148, 163, 184, 0.06);
        border-radius: 6px;
        z-index: 2147483646;
        transition: all 0.05s ease;
        display: none;
      }
      .pick-highlight-label {
        display: none;
      }

      /* Thanh hướng dẫn nổi khi đang ở chế độ Chỉ câu */
      .pick-banner {
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #0284c7, #2563eb);
        color: #fff;
        padding: 7px 16px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 700;
        z-index: 2147483647;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
        display: none;
        align-items: center;
        gap: 10px;
      }
      .pick-banner.visible { display: flex; }
      .pick-cancel-btn {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.4);
        color: #fff;
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 11px;
        cursor: pointer;
      }

      /* Quả cầu tròn nhỏ gọn (Ghost Orb) */
      .floating-orb {
        position: fixed;
          bottom: 85px;
          right: 24px;
          width: 36px;
          height: 36px;
        border-radius: 50%;
        background: rgba(30, 41, 59, 0.9);
        border: 1px solid #475569;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
        z-index: 2147483647;
        transition: opacity 0.2s, transform 0.2s;
        user-select: none;
        backdrop-filter: blur(4px);
      }
      .floating-orb:hover {
        transform: scale(1.1);
        background: #2563eb;
        border-color: #60a5fa;
      }
      .floating-orb:active { cursor: grabbing; }
      .floating-orb svg { width: 15px; height: 15px; fill: #cbd5e1; }
      .floating-orb.hidden { display: none !important; }

      /* Cửa sổ AI Mini Stealth Window */
      .ai-window {
        position: fixed;
        top: 12px;
        right: 12px;
        width: 325px;
        max-width: calc(100vw - 20px);
        background: rgba(15, 23, 42, 0.96);
        border: 1px solid #334155;
        border-radius: 10px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.55);
        color: #f1f5f9;
        display: none;
        flex-direction: column;
        z-index: 2147483647;
        overflow: hidden;
        backdrop-filter: blur(8px);
        transition: opacity 0.2s, width 0.2s;
      }
      .ai-window.visible { display: flex; }

      /* Chế độ siêu nhỏ (Mini Bar) */
      .ai-window.mini-mode {
        width: 265px;
      }
      .ai-window.mini-mode .window-body {
        padding: 6px 8px;
        gap: 6px;
      }
      .ai-window.mini-mode .prompt-box,
      .ai-window.mini-mode .action-bar,
      .ai-window.mini-mode .model-bar,
      .ai-window.mini-mode .key-inline-box,
      .ai-window.mini-mode .question-pills,
      .ai-window.mini-mode .status-footer {
        display: none !important;
      }
      .ai-window.mini-mode .btn-turbo-solve {
        padding: 5px 8px;
        font-size: 11px;
      }

      /* Header kéo thả */
      .window-header {
        padding: 6px 8px;
        background: rgba(30, 41, 59, 0.95);
        border-bottom: 1px solid #334155;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: move;
        user-select: none;
      }
      .header-title {
        display: flex;
        align-items: center;
        gap: 5px;
        font-weight: 600;
        font-size: 11px;
        color: #94a3b8;
      }
      .shield-badge {
        font-size: 9.5px;
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
        border: 1px solid rgba(16, 185, 129, 0.3);
        padding: 1px 4px;
        border-radius: 4px;
      }
      .header-tools {
        display: flex;
        align-items: center;
        gap: 3px;
      }
      .btn-tool {
        background: transparent;
        border: 1px solid transparent;
        color: #94a3b8;
        cursor: pointer;
        padding: 2px 5px;
        border-radius: 4px;
        font-size: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .btn-tool:hover {
        background: #334155;
        color: #fff;
        border-color: #475569;
      }

      .window-body {
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 7px;
        max-height: 520px;
        overflow-y: auto;
      }

      /* Thanh chọn AI & Model trực tiếp trong HUD */
      .model-bar {
        display: flex;
        gap: 4px;
        align-items: center;
      }
      .hud-select {
        background: #0b1120;
        border: 1px solid #334155;
        border-radius: 5px;
        color: #e2e8f0;
        font-size: 10.5px;
        padding: 4px 5px;
        outline: none;
        cursor: pointer;
      }
      .hud-select:focus { border-color: #38bdf8; }
      .hud-select-provider {
        width: 94px;
        flex-shrink: 0;
        font-weight: 600;
        color: #38bdf8;
      }
      .hud-select-model {
        flex: 1;
        min-width: 0;
      }
      .btn-key-toggle {
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 5px;
        color: #fbbf24;
        font-size: 10.5px;
        padding: 4px 6px;
        cursor: pointer;
        flex-shrink: 0;
      }
      .btn-key-toggle:hover { background: #334155; }

      .key-inline-box {
        display: none;
        gap: 4px;
        background: rgba(15, 23, 42, 0.9);
        border: 1px dashed #475569;
        border-radius: 6px;
        padding: 5px;
      }
      .key-inline-box.visible { display: flex; }
      .key-inline-input {
        flex: 1;
        background: #020617;
        border: 1px solid #334155;
        border-radius: 4px;
        color: #f8fafc;
        font-size: 10.5px;
        padding: 4px 6px;
        outline: none;
      }
      .btn-key-save {
        background: #10b981;
        border: none;
        border-radius: 4px;
        color: #fff;
        font-size: 10px;
        font-weight: 700;
        padding: 4px 8px;
        cursor: pointer;
      }

      /* 4 nút thao tác lấy câu hỏi */
      .action-bar {
        display: flex;
        gap: 4px;
      }
      .action-btn {
        flex: 1;
        padding: 6px 4px;
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 6px;
        color: #cbd5e1;
        font-size: 10.5px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
        white-space: nowrap;
      }
      .action-btn:hover {
        background: #334155;
        color: #fff;
        border-color: #38bdf8;
      }
      .action-btn.active-pick {
        background: rgba(16, 185, 129, 0.25);
        border-color: #10b981;
        color: #34d399;
      }

      /* Danh sách các câu hỏi quét được trên trang ([Câu 1] [Câu 2] ...) */
      .question-pills {
        display: none;
        flex-wrap: wrap;
        gap: 4px;
        max-height: 74px;
        overflow-y: auto;
        padding: 5px;
        background: #0b1120;
        border: 1px solid #1e293b;
        border-radius: 6px;
        align-items: center;
      }
      .question-pills.visible { display: flex; }
      .pills-label {
        font-size: 10px;
        color: #64748b;
        margin-right: 2px;
      }
      .q-pill {
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 4px;
        color: #cbd5e1;
        font-size: 10.5px;
        font-weight: 600;
        padding: 3px 7px;
        cursor: pointer;
        transition: all 0.12s;
      }
      .q-pill:hover, .q-pill.active {
        background: #2563eb;
        border-color: #60a5fa;
        color: #fff;
      }

      .prompt-box {
        width: 100%;
        min-height: 54px;
        max-height: 90px;
        background: #0b1120;
        border: 1px solid #334155;
        border-radius: 6px;
        padding: 6px 8px;
        color: #f1f5f9;
        font-size: 11.5px;
        resize: vertical;
        outline: none;
      }
      .prompt-box:focus { border-color: #3b82f6; }

      .btn-turbo-solve {
        width: 100%;
        padding: 7px 10px;
        background: linear-gradient(135deg, #2563eb, #0891b2);
        border: none;
        border-radius: 6px;
        color: white;
        font-weight: 700;
        font-size: 11.5px;
        cursor: pointer;
      }
      .btn-turbo-solve:hover { opacity: 0.92; }

      .result-container {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .result-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .result-title {
        font-size: 10.5px;
        font-weight: 700;
        color: #38bdf8;
      }
      .result-actions {
        display: flex;
        gap: 4px;
      }
      .btn-copy-ans {
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 4px;
        color: #cbd5e1;
        font-size: 10px;
        padding: 2px 6px;
        cursor: pointer;
      }
      .btn-copy-ans:hover { background: #334155; color: #fff; }

      .result-box {
        background: #020617;
        border: 1px solid #1e293b;
        border-radius: 6px;
        padding: 8px 10px;
        font-size: 12px;
        line-height: 1.45;
        color: #f1f5f9;
        max-height: 185px;
        overflow-y: auto;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .loading-spinner {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #fbbf24;
        font-size: 11.5px;
      }
      .spinner {
        width: 12px;
        height: 12px;
        border: 2px solid rgba(251, 191, 36, 0.25);
        border-top-color: #fbbf24;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      .status-footer {
        padding: 4px 10px;
        background: #0b1120;
        border-top: 1px solid #1e293b;
        font-size: 9.5px;
        color: #64748b;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      kbd {
        background: #1e293b;
        border: 1px solid #475569;
        border-radius: 3px;
        padding: 0px 4px;
        color: #fbbf24;
        font-family: monospace;
      }
    `;

    shadowRoot.appendChild(style);

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <!-- Khung viền xanh chọn câu hỏi (Nằm trong Shadow DOM để không bao giờ bị lỗi CSS) -->
      <div class="pick-highlight-overlay" id="pickOverlay">
        <div class="pick-highlight-label">👆 Click chuột trái để giải câu hỏi này</div>
      </div>

      <!-- Thanh thông báo khi đang ở chế độ Chỉ câu -->
      <div class="pick-banner" id="pickBanner">
        <span>🎯 Di chuột vào câu hỏi cần giải rồi <strong>CLICK CHUỘT TRÁI</strong></span>
        <button class="pick-cancel-btn" id="btnCancelPick">Hủy (Alt+S)</button>
      </div>

      <!-- Chấm tròn nhỏ gọn -->
      <div class="floating-orb" id="orbBtn" title="Mở Wayground AI (Alt + Q)">
        <svg viewBox="0 0 24 24">
          <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
        </svg>
      </div>

      <!-- Cửa sổ Mini Stealth HUD -->
      <div class="ai-window" id="aiWindow">
        <div class="window-header" id="dragHeader" title="Giữ chuột vào đây để kéo di chuyển">
          <div class="header-title">
            <span>⚙️ System HUD</span>
            <span class="shield-badge" title="Đã bật bảo vệ chống phát hiện chuyển tab & thoát Fullscreen">🛡️ Anti-Detect</span>
          </div>
          <div class="header-tools">
            <button class="btn-tool" id="btnFullscreen" title="Bật lại Toàn màn hình (Fullscreen) nếu lỡ thoát">🖥️ Full</button>
            <button class="btn-tool" id="btnSnapTop" title="Đưa lên mép trên cùng">⬆ Đỉnh</button>
            <button class="btn-tool" id="btnToggleMini" title="Thu nhỏ / Phóng to">📐 Mini</button>
            <button class="btn-tool" id="btnToggleOpacity" title="Đổi độ mờ trong suốt">👁️ Mờ</button>
            <button class="btn-tool" id="minimizeBtn" title="Đóng nhanh (Bấm phím Ctrl)">✕</button>
          </div>
        </div>

        <div class="window-body">
          <!-- Thanh đổi nhanh AI Provider & Model ngay trong bài thi -->
          <div class="model-bar">
            <select class="hud-select hud-select-provider" id="hudProviderSelect" title="Đổi hãng AI ngay tại đây">
              <option value="openrouter">🆓 OpenRouter</option>
              <option value="groq">⚡ Groq</option>
              <option value="gemini">✨ Gemini</option>
              <option value="deepseek">🐳 DeepSeek</option>
              <option value="chatgpt">🤖 ChatGPT</option>
            </select>
            <select class="hud-select hud-select-model" id="hudModelSelect" title="Đổi Model ngay lập tức nếu model hiện tại bị lỗi/chậm"></select>
            <button class="btn-key-toggle" id="btnToggleKeyBox" title="Nhập/Đổi API Key ngay tại đây">🔑</button>
          </div>

          <div class="key-inline-box" id="keyInlineBox">
            <input type="password" class="key-inline-input" id="hudKeyInput" placeholder="Dán API Key mới vào đây...">
            <button class="btn-key-save" id="btnSaveHudKey">Lưu Key</button>
          </div>

          <!-- 4 Chế độ lấy đề -->
          <div class="action-bar">
            <button class="action-btn" id="btnSolveSelected" title="Giải phần văn bản bạn vừa bôi đen">🎯 Bôi đen</button>
            <button class="action-btn" id="btnPickQuestion" title="Bấm nút này rồi CLICK vào câu hỏi bất kỳ trên trang để giải">👆 Chỉ câu</button>
            <button class="action-btn" id="btnAutoScan" title="Quét toàn bộ câu hỏi trên trang thành danh sách nút Câu 1, Câu 2...">🔍 Quét đề</button>
            <button class="action-btn" id="btnCaptureSolve" title="Chụp màn hình giải đề bằng AI Vision (Khi đề là ảnh/Canvas)">📸 Chụp</button>
          </div>

          <!-- Thanh chọn nhanh [Câu 1] [Câu 2] [Câu 3]... -->
          <div class="question-pills" id="questionPills"></div>

          <textarea class="prompt-box" id="promptInput" placeholder="Bôi đen câu hỏi trên trang (tự động nhận) hoặc bấm [Câu 1], [Câu 2] ở trên..."></textarea>

          <button class="btn-turbo-solve" id="btnSendPrompt">
            ⚡ Phân Tích Ngay
          </button>

          <div class="result-container" id="resultContainer" style="display: none;">
            <div class="result-header">
              <div class="result-title" id="resultTitle">✨ KẾT QUẢ:</div>
              <div class="result-actions">
                <button class="btn-copy-ans" id="btnRetryOtherModel" title="Thử giải lại câu này bằng Model khác">🔄 Đổi Model giải lại</button>
                <button class="btn-copy-ans" id="btnCopyAns">📋 Copy</button>
              </div>
            </div>
            <div class="result-box" id="resultText"></div>
          </div>
        </div>

        <div class="status-footer">
          <span>Ẩn: <kbd>Alt+H</kbd> | Chỉ câu: <kbd>Alt+S</kbd> | Giải: <kbd>Alt+Q</kbd></span>
          <span id="statusNote">Sẵn sàng</span>
        </div>
      </div>
    `;

    shadowRoot.appendChild(wrapper);
    applyStealthOrbVisibility();
    setupEvents(shadowRoot);
    syncHudModelSelectors();

    if (wasOldHudOpen) {
      const aiWindow = shadowRoot.getElementById("aiWindow");
      if (aiWindow) {
        aiWindow.classList.add("visible");
        widgetVisible = true;
      }
    }
  }

  function applyStealthOrbVisibility() {
    if (!shadowRoot) return;
    const orb = shadowRoot.getElementById("orbBtn");
    if (orb) {
      if (stealthMode) {
        orb.classList.add("hidden");
      } else {
        orb.classList.remove("hidden");
      }
    }
  }

  function removeUI() {
    if (widgetContainer) {
      widgetContainer.remove();
      widgetContainer = null;
      shadowRoot = null;
    }
  }

  function syncHudModelSelectors() {
    if (!shadowRoot) return;
    const hudProviderSelect = shadowRoot.getElementById("hudProviderSelect");
    const hudModelSelect = shadowRoot.getElementById("hudModelSelect");
    const hudKeyInput = shadowRoot.getElementById("hudKeyInput");
    if (!hudProviderSelect || !hudModelSelect) return;

    chrome.storage.local.get(
      [
        "aiProvider",
        "geminiModel",
        "deepseekModel",
        "openaiModel",
        "groqModel",
        "openrouterModel",
        "geminiApiKey",
        "deepseekApiKey",
        "openaiApiKey",
        "groqApiKey",
        "openrouterApiKey"
      ],
      (res) => {
        if (chrome.runtime.lastError) return;
        const provider = res.aiProvider || "gemini";
        hudProviderSelect.value = PROVIDER_MODELS[provider] ? provider : "gemini";
        populateHudModelOptions(hudProviderSelect.value, res);

        if (hudKeyInput) {
          const keyMap = {
            gemini: res.geminiApiKey,
            deepseek: res.deepseekApiKey,
            chatgpt: res.openaiApiKey,
            groq: res.groqApiKey,
            openrouter: res.openrouterApiKey
          };
          hudKeyInput.value = keyMap[hudProviderSelect.value] || "";
        }
      }
    );
  }

  function populateHudModelOptions(provider, storageRes = {}) {
    if (!shadowRoot) return;
    const hudModelSelect = shadowRoot.getElementById("hudModelSelect");
    if (!hudModelSelect) return;

    const models = PROVIDER_MODELS[provider] || PROVIDER_MODELS.gemini;
    hudModelSelect.innerHTML = "";

    const currentModelMap = {
      gemini: storageRes.geminiModel || "gemini-2.5-flash",
      deepseek: storageRes.deepseekModel || "deepseek-chat",
      chatgpt: storageRes.openaiModel || "gpt-4o-mini",
      groq: storageRes.groqModel || "llama-3.3-70b-versatile",
      openrouter: storageRes.openrouterModel || "deepseek/deepseek-chat-v3-0324:free"
    };
    const savedModel = currentModelMap[provider];

    models.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.value;
      opt.textContent = m.label;
      if (m.value === savedModel) opt.selected = true;
      hudModelSelect.appendChild(opt);
    });
  }

  // ==========================================
  // PHẦN 3: XỬ LÝ SỰ KIỆN, PHÍM TẮT & 4 CÁCH LẤY CÂU HỎI
  // ==========================================
  function setupEvents(root) {
    const orb = root.getElementById("orbBtn");
    const aiWindow = root.getElementById("aiWindow");
    const dragHeader = root.getElementById("dragHeader");
    const minimizeBtn = root.getElementById("minimizeBtn");
    const btnFullscreen = root.getElementById("btnFullscreen");
    const btnSnapTop = root.getElementById("btnSnapTop");
    const btnToggleMini = root.getElementById("btnToggleMini");
    const btnToggleOpacity = root.getElementById("btnToggleOpacity");
    const hudProviderSelect = root.getElementById("hudProviderSelect");
    const hudModelSelect = root.getElementById("hudModelSelect");
    const btnToggleKeyBox = root.getElementById("btnToggleKeyBox");
    const keyInlineBox = root.getElementById("keyInlineBox");
    const hudKeyInput = root.getElementById("hudKeyInput");
    const btnSaveHudKey = root.getElementById("btnSaveHudKey");
    const btnSolveSelected = root.getElementById("btnSolveSelected");
    const btnPickQuestion = root.getElementById("btnPickQuestion");
    const btnAutoScan = root.getElementById("btnAutoScan");
    const btnCaptureSolve = root.getElementById("btnCaptureSolve");
    const questionPills = root.getElementById("questionPills");
    const promptInput = root.getElementById("promptInput");
    const btnSendPrompt = root.getElementById("btnSendPrompt");
    const resultContainer = root.getElementById("resultContainer");
    const resultText = root.getElementById("resultText");
    const statusNote = root.getElementById("statusNote");
    const btnCopyAns = root.getElementById("btnCopyAns");
    const btnRetryOtherModel = root.getElementById("btnRetryOtherModel");
    const pickOverlay = root.getElementById("pickOverlay");
    const pickBanner = root.getElementById("pickBanner");
    const btnCancelPick = root.getElementById("btnCancelPick");

    const savedTop = sessionStorage.getItem("wg_win_top");
    const savedLeft = sessionStorage.getItem("wg_win_left");
    if (savedTop && savedLeft) {
      aiWindow.style.top = savedTop;
      aiWindow.style.left = savedLeft;
      aiWindow.style.right = "auto";
    }

    orb.addEventListener("click", () => toggleWidget());
    minimizeBtn.addEventListener("click", () => closeWidget());
    btnCancelPick.addEventListener("click", () => stopPickQuestionMode());

    btnFullscreen.addEventListener("click", () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (!fsEl) {
        const reqFs =
          document.documentElement.requestFullscreen ||
          document.documentElement.webkitRequestFullscreen;
        if (reqFs) {
          reqFs.call(document.documentElement).then(() => {
            ensureHudInsideFullscreen();
            statusNote.textContent = "🖥️ Đã vào lại Fullscreen";
          }).catch(() => {});
        }
      } else {
        ensureHudInsideFullscreen();
        statusNote.textContent = "🖥️ Đang ở Fullscreen";
      }
    });

    btnSnapTop.addEventListener("click", () => {
      aiWindow.style.top = "6px";
      aiWindow.style.left = "auto";
      aiWindow.style.right = "10px";
      sessionStorage.setItem("wg_win_top", "6px");
      sessionStorage.setItem("wg_win_left", "");
    });

    btnToggleOpacity.addEventListener("click", () => {
      currentOpacityIndex = (currentOpacityIndex + 1) % opacityLevels.length;
      const op = opacityLevels[currentOpacityIndex];
      aiWindow.style.opacity = op;
      btnToggleOpacity.textContent = op === 1.0 ? "👁️ Rõ" : op === 0.45 ? "👁️ Mờ" : "👁️ Ẩn";
    });

    btnToggleMini.addEventListener("click", () => {
      isMiniMode = !isMiniMode;
      if (isMiniMode) {
        aiWindow.classList.add("mini-mode");
        btnToggleMini.textContent = "📐 Lớn";
      } else {
        aiWindow.classList.remove("mini-mode");
        btnToggleMini.textContent = "📐 Mini";
      }
    });

    hudProviderSelect.addEventListener("change", () => {
      const newProvider = hudProviderSelect.value;
      chrome.storage.local.get(null, (res) => {
        populateHudModelOptions(newProvider, res || {});
        const selectedModel = hudModelSelect.value;
        saveHudProviderAndModel(newProvider, selectedModel);
        statusNote.textContent = `Đã chuyển sang ${newProvider}`;
      });
    });

    hudModelSelect.addEventListener("change", () => {
      const provider = hudProviderSelect.value;
      const model = hudModelSelect.value;
      saveHudProviderAndModel(provider, model, () => {
        statusNote.textContent = `Đã chọn: ${model.split("/").pop()}`;
        const currentQ = promptInput.value.trim();
        if (currentQ) solvePrompt(currentQ);
      });
    });

    btnToggleKeyBox.addEventListener("click", () => {
      keyInlineBox.classList.toggle("visible");
      if (keyInlineBox.classList.contains("visible")) {
        syncHudModelSelectors();
        hudKeyInput.focus();
      }
    });

    btnSaveHudKey.addEventListener("click", () => {
      const val = hudKeyInput.value.trim();
      if (!val) return;
      let targetProvider = hudProviderSelect.value;
      if (val.startsWith("AIza")) targetProvider = "gemini";
      else if (val.startsWith("gsk_")) targetProvider = "groq";
      else if (val.startsWith("sk-or-")) targetProvider = "openrouter";
      else if (/^sk-[0-9a-f]{32}$/i.test(val)) targetProvider = "deepseek";
      else if (val.startsWith("sk-proj-")) targetProvider = "chatgpt";

      const keyFieldMap = {
        gemini: "geminiApiKey",
        deepseek: "deepseekApiKey",
        chatgpt: "openaiApiKey",
        groq: "groqApiKey",
        openrouter: "openrouterApiKey"
      };

      chrome.storage.local.set(
        { aiProvider: targetProvider, [keyFieldMap[targetProvider]]: val },
        () => {
          keyInlineBox.classList.remove("visible");
          syncHudModelSelectors();
          statusNote.textContent = `✅ Đã lưu Key (${targetProvider})`;
          const currentQ = promptInput.value.trim();
          if (currentQ) solvePrompt(currentQ);
        }
      );
    });

    btnRetryOtherModel.addEventListener("click", () => {
      if (hudModelSelect.options.length > 1) {
        hudModelSelect.selectedIndex =
          (hudModelSelect.selectedIndex + 1) % hudModelSelect.options.length;
        const provider = hudProviderSelect.value;
        const model = hudModelSelect.value;
        saveHudProviderAndModel(provider, model, () => {
          const currentQ = promptInput.value.trim();
          if (currentQ) solvePrompt(currentQ);
        });
      }
    });

    // =========================================================
    // CÁCH 1: NÚT "🎯 BÔI ĐEN" (Không bao giờ làm mất vùng vừa bôi đen!)
    // =========================================================
    btnSolveSelected.addEventListener("mousedown", (e) => {
      // Ngăn trình duyệt xóa vùng bôi đen khi bấm vào nút!
      e.preventDefault();
    });

    btnSolveSelected.addEventListener("click", () => {
      const liveSel = window.getSelection().toString().trim();
      const textToSolve = liveSel || lastSelectedText || promptInput.value.trim();
      if (textToSolve) {
        promptInput.value = textToSolve;
        solvePrompt(textToSolve);
      } else {
        statusNote.textContent = "Hãy bôi đen chữ trên trang hoặc bấm [Câu 1], [Câu 2]!";
      }
    });

    // =========================================================
    // CÁCH 2: NÚT "👆 CHỈ CÂU" (Di chuột & Click vào câu hỏi bất kỳ để lấy đề)
    // =========================================================
    btnPickQuestion.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isPickQuestionMode) {
        stopPickQuestionMode();
      } else {
        startPickQuestionMode();
      }
    });

    // =========================================================
    // CÁCH 3: NÚT "🔍 QUÉT ĐỀ" (Quét danh sách [Câu 1] [Câu 2] [Câu 3]...)
    // =========================================================
    btnAutoScan.addEventListener("click", () => {
      const questions = scanAllQuestionsOnPage();
      scannedQuestionsList = questions;

      if (questions.length > 0) {
        renderQuestionPills(questions);
        const bestIdx = findQuestionClosestToViewportCenter(questions);
        selectScannedQuestion(bestIdx);
      } else {
        questionPills.classList.remove("visible");
        statusNote.textContent = "Không thấy câu hỏi chữ! Hãy bấm '📸 Chụp'";
      }
    });

    // =========================================================
    // CÁCH 4: NÚT "📸 CHỤP" (Giải đề bằng hình ảnh / Canvas)
    // =========================================================
    if (btnCaptureSolve) {
      btnCaptureSolve.addEventListener("click", () => {
        captureScreenAndSolve();
      });
    }

    function findVisibleCanvasPayload() {
      let bestCanvas = null;
      let minDist = Infinity;
      const centerY = window.innerHeight / 2;
      try {
        const canvases = document.querySelectorAll("canvas");
        canvases.forEach((cv) => {
          const rect = cv.getBoundingClientRect();
          if (rect.width > 50 && rect.height > 40 && rect.bottom > 0 && rect.top < window.innerHeight) {
            const dist = Math.abs(rect.top + rect.height / 2 - centerY);
            if (dist < minDist) {
              minDist = dist;
              bestCanvas = cv;
            }
          }
        });
      } catch (_) {}

      if (!bestCanvas) return { canvasDataUrl: null, canvasText: "" };
      let canvasDataUrl = null;
      try {
        canvasDataUrl = bestCanvas.toDataURL("image/jpeg", 0.85);
      } catch (_) {}
      const canvasText = (bestCanvas.getAttribute("data-wg-canvas-text") || "").trim();
      return { canvasDataUrl, canvasText };
    }

    function captureScreenAndSolve() {
      if (!chrome.runtime || !chrome.runtime.id) {
        statusNote.textContent = "Hãy F5 lại trang!";
        return;
      }

      const { canvasDataUrl, canvasText } = findVisibleCanvasPayload();

      aiWindow.style.visibility = "hidden";
      if (orb) orb.style.visibility = "hidden";

      setTimeout(() => {
        const startTime = performance.now();
        chrome.runtime.sendMessage(
          { action: "CAPTURE_AND_SOLVE", canvasDataUrl, canvasText },
          (res) => {
            aiWindow.style.visibility = "visible";
            if (orb) orb.style.visibility = "visible";
            toggleWidget(true);
            resultContainer.style.display = "flex";

            const duration = ((performance.now() - startTime) / 1000).toFixed(2);
            if (chrome.runtime.lastError) {
              // Nếu Service Worker nền chưa kịp reload nhưng đã bắt được chữ từ Canvas (hoặc câu hỏi trên màn hình), tự động giải luôn qua CALL_AI_API!
              if (canvasText) {
                promptInput.value = canvasText;
                solvePrompt(canvasText);
                return;
              }
              const fallbackQuestions = scanAllQuestionsOnPage();
              if (fallbackQuestions.length > 0) {
                const idx = findQuestionClosestToViewportCenter(fallbackQuestions);
                const qText = fallbackQuestions[idx]?.text;
                if (qText) {
                  promptInput.value = qText;
                  solvePrompt(qText);
                  return;
                }
              }
              resultText.textContent =
                "⚠️ Bạn cần bấm nút '🔄 Cập nhật HUD' trong Popup (hoặc Reload ở chrome://extensions) để nạp dịch vụ chụp ảnh mới nhất!";
              statusNote.textContent = "Cần Reload Extension";
              return;
            }
            if (res && res.success) {
              promptInput.value =
                canvasText || "[📸 Đã chụp màn hình trang thi & đọc đề bằng AI Vision]";
              resultText.textContent = res.data;
              statusNote.textContent = `📸 ${duration}s (${res.provider || "Vision"})`;
            } else {
              if (canvasText) {
                promptInput.value = canvasText;
                solvePrompt(canvasText);
                return;
              }
              resultText.textContent =
                "❌ " + (res ? res.error : "Không thể giải từ ảnh chụp");
              statusNote.textContent = "Lỗi Vision";
            }
          }
        );
      }, 80);
    }

    // Hiển thị thanh nút [Câu 1] [Câu 2] [Câu 3]...
    function renderQuestionPills(questions) {
      questionPills.innerHTML = "";
      if (!questions || questions.length === 0) {
        questionPills.classList.remove("visible");
        return;
      }
      questionPills.classList.add("visible");
      const lbl = document.createElement("span");
      lbl.className = "pills-label";
      lbl.textContent = "Chọn nhanh:";
      questionPills.appendChild(lbl);

      questions.forEach((qObj, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "q-pill";
        btn.textContent = qObj.label || `Câu ${idx + 1}`;
        btn.title = qObj.text.substring(0, 140);
        btn.addEventListener("click", () => {
          selectScannedQuestion(idx);
        });
        questionPills.appendChild(btn);
      });
    }

    function selectScannedQuestion(idx) {
      if (!scannedQuestionsList[idx]) return;
      const pills = questionPills.querySelectorAll(".q-pill");
      pills.forEach((p, i) => p.classList.toggle("active", i === idx));

      const qText = scannedQuestionsList[idx].text;
      promptInput.value = qText;
      solvePrompt(qText);
    }

    btnSendPrompt.addEventListener("click", () => {
      const text = promptInput.value.trim();
      if (text) solvePrompt(text);
      else promptInput.focus();
    });

    btnCopyAns.addEventListener("click", () => {
      const text = resultText.textContent;
      if (text) {
        navigator.clipboard.writeText(text).then(() => {
          btnCopyAns.textContent = "✅ Đã copy";
          setTimeout(() => {
            btnCopyAns.textContent = "📋 Copy";
          }, 1400);
        });
      }
    });

    // PHÍM TẮT TOÀN CỤC:
    // - Alt + Q: Giải ngay vùng đang bôi đen hoặc câu hỏi dưới con trỏ chuột
    // - Alt + S: Bật/tắt chế độ "👆 Chỉ câu"
    // - Alt + V: Chụp màn hình giải đề bằng AI Vision
    // - Alt + H / Alt + X: Ẩn HUD an toàn không thoát Fullscreen
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.altKey && (e.key === "h" || e.key === "H" || e.key === "x" || e.key === "X")) {
          e.preventDefault();
          e.stopImmediatePropagation();
          stopPickQuestionMode();
          closeWidget();
          return;
        }

        // Phím Ctrl: Tắt nhanh bảng HUD hoặc Hủy chế độ Chỉ câu (Ngay lập tức)
        if (e.key === "Control" || e.code === "ControlLeft" || e.code === "ControlRight") {
          if (isPickQuestionMode) {
            e.preventDefault();
            e.stopImmediatePropagation();
            stopPickQuestionMode();
          } else if (widgetVisible) {
            e.preventDefault();
            e.stopImmediatePropagation();
            closeWidget();
          }
        }

        if (e.altKey && (e.key === "s" || e.key === "S")) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (isPickQuestionMode) stopPickQuestionMode();
          else startPickQuestionMode();
          return;
        }

        if (e.altKey && (e.key === "v" || e.key === "V")) {
          e.preventDefault();
          e.stopImmediatePropagation();
          captureScreenAndSolve();
          return;
        }

        if (e.altKey && (e.key === "q" || e.key === "Q")) {
          e.preventDefault();
          e.stopImmediatePropagation();
          ensureHudInsideFullscreen();
          let selected = window.getSelection().toString().trim();

          // Nếu không có chữ đang bôi đen trực tiếp, lấy câu hỏi ngay dưới vị trí con trỏ chuột
          if (!selected && lastHoveredElement) {
            selected = extractQuestionFromElement(lastHoveredElement);
          }
          // Hoặc lấy chữ vừa bôi đen gần nhất
          if (!selected && lastSelectedText) {
            selected = lastSelectedText;
          }
          // Hoặc quét câu hỏi giữa màn hình
          if (!selected) {
            const allQ = scanAllQuestionsOnPage();
            if (allQ.length > 0) {
              scannedQuestionsList = allQ;
              renderQuestionPills(allQ);
              const bestIdx = findQuestionClosestToViewportCenter(allQ);
              selected = allQ[bestIdx]?.text || "";
            }
          }

          toggleWidget(true);
          if (selected) {
            promptInput.value = selected;
            solvePrompt(selected);
          }
        }
      },
      true
    );

    makeDraggable(orb);
    makeDraggableWindow(aiWindow, dragHeader);

    function closeWidget() {
      aiWindow.classList.remove("visible");
      widgetVisible = false;
    }

    function toggleWidget(forceOpen = false) {
      ensureHudInsideFullscreen();
      if (forceOpen || !widgetVisible) {
        aiWindow.classList.add("visible");
        widgetVisible = true;
        // Tự động quét sẵn danh sách [Câu 1] [Câu 2] [Câu 3]... ngay khi mở HUD để người dùng bấm chọn được luôn!
        const questions = scanAllQuestionsOnPage();
        if (questions.length > 0) {
          scannedQuestionsList = questions;
          renderQuestionPills(questions);
        }
      } else {
        closeWidget();
      }
    }

    function saveHudProviderAndModel(provider, model, callback) {
      const modelKeyMap = {
        gemini: "geminiModel",
        deepseek: "deepseekModel",
        chatgpt: "openaiModel",
        groq: "groqModel",
        openrouter: "openrouterModel"
      };
      const update = { aiProvider: provider };
      if (modelKeyMap[provider] && model) {
        update[modelKeyMap[provider]] = model;
      }
      chrome.storage.local.set(update, () => {
        if (callback) callback();
      });
    }

    function solvePrompt(question) {
      resultContainer.style.display = "flex";
      resultText.innerHTML = `
        <div class="loading-spinner">
          <div class="spinner"></div>
          <span>Đang giải bằng ${hudProviderSelect.value.toUpperCase()}...</span>
        </div>
      `;
      const startTime = performance.now();
      statusNote.textContent = "Đang xử lý...";

      if (!chrome.runtime || !chrome.runtime.id) {
        resultText.textContent =
          "⚠️ Tiện ích vừa được cập nhật! Hãy bấm F5 (tải lại trang) 1 lần để kết nối lại.";
        statusNote.textContent = "Cần F5 trang";
        return;
      }

      try {
        chrome.runtime.sendMessage(
          { action: "CALL_AI_API", questionText: question },
          (res) => {
            const duration = ((performance.now() - startTime) / 1000).toFixed(2);

            if (chrome.runtime.lastError) {
              const errMsg = chrome.runtime.lastError.message || "";
              if (
                errMsg.includes("Extension context invalidated") ||
                errMsg.includes("Receiving end does not exist")
              ) {
                resultText.textContent =
                  "⚠️ Tiện ích vừa được tải lại! Hãy bấm F5 (tải lại trang web này) rồi thử lại nhé.";
              } else {
                resultText.textContent = "Lỗi kết nối: " + errMsg;
              }
              statusNote.textContent = "Lỗi";
              return;
            }

            if (res && res.success) {
              resultText.textContent = res.data;
              statusNote.textContent = `⚡ ${duration}s (${res.provider || ""})`;
            } else {
              resultText.textContent =
                "❌ " +
                (res ? res.error : "Không thể gọi API") +
                "\n\n💡 Bạn có thể đổi ngay Model / Hãng AI ở thanh phía trên hoặc bấm '🔄 Đổi Model giải lại'!";
              statusNote.textContent = "Lỗi - Hãy đổi Model";
            }
          }
        );
      } catch (err) {
        resultText.textContent =
          "⚠️ Tiện ích vừa được cập nhật! Hãy bấm F5 tải lại trang web này.";
        statusNote.textContent = "Cần F5";
      }
    }

    // ==========================================
    // CHẾ ĐỘ "👆 CHỈ CÂU" (LÀM MỜ TẠM HUD ĐỂ DỄ CLICK VÀO CÂU HỎI BẤT KỲ)
    // ==========================================
    function startPickQuestionMode() {
      isPickQuestionMode = true;
      btnPickQuestion.classList.add("active-pick");
      btnPickQuestion.textContent = "🎯 Đang chọn...";
      statusNote.textContent = "Click vào câu hỏi trên trang!";

      // Tạm ẩn/làm mờ cửa sổ HUD để không che câu hỏi bên dưới
      aiWindow.style.opacity = "0.15";
      aiWindow.style.pointerEvents = "none";
      if (pickBanner) pickBanner.classList.add("visible");

      setTimeout(() => {
        window.addEventListener("mousemove", onPickMouseMove, true);
        window.addEventListener("mousedown", onPickMouseDown, true);
        window.addEventListener("click", onPickMouseClick, true);
      }, 30);
    }

    function stopPickQuestionMode() {
      isPickQuestionMode = false;
      if (btnPickQuestion) {
        btnPickQuestion.classList.remove("active-pick");
        btnPickQuestion.textContent = "👆 Chỉ câu";
      }
      if (pickOverlay) pickOverlay.style.display = "none";
      if (pickBanner) pickBanner.classList.remove("visible");

      // Khôi phục lại độ rõ của HUD
      aiWindow.style.opacity = String(opacityLevels[currentOpacityIndex] || 1.0);
      aiWindow.style.pointerEvents = "auto";

      window.removeEventListener("mousemove", onPickMouseMove, true);
      window.removeEventListener("mousedown", onPickMouseDown, true);
      window.removeEventListener("click", onPickMouseClick, true);
    }

    function onPickMouseMove(e) {
      if (!isPickQuestionMode) return;
      const deepEl = getDeepElementAtPoint(e.clientX, e.clientY);
      if (!deepEl) {
        if (pickOverlay) pickOverlay.style.display = "none";
        return;
      }
      const targetBox = findBestQuestionContainer(deepEl);
      if (targetBox && pickOverlay) {
        const rect = targetBox.getBoundingClientRect();
        pickOverlay.style.display = "block";
        pickOverlay.style.top = rect.top + "px";
        pickOverlay.style.left = rect.left + "px";
        pickOverlay.style.width = rect.width + "px";
        pickOverlay.style.height = rect.height + "px";
      }
    }

    function onPickMouseDown(e) {
      if (!isPickQuestionMode) return;
      if (widgetContainer && (e.target === widgetContainer || widgetContainer.contains(e.target))) {
        return;
      }
      // Chặn sự kiện mousedown để không vô tình tích chọn nhầm đáp án radio của trang thi
      e.preventDefault();
      e.stopPropagation();
    }

    function onPickMouseClick(e) {
      if (!isPickQuestionMode) return;
      if (widgetContainer && (e.target === widgetContainer || widgetContainer.contains(e.target))) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const deepEl = getDeepElementAtPoint(e.clientX, e.clientY) || e.target;
      const extracted = extractQuestionFromElement(deepEl);
      stopPickQuestionMode();

      toggleWidget(true);
      if (extracted) {
        promptInput.value = extracted;
        solvePrompt(extracted);
      } else {
        statusNote.textContent = "Đề bằng ảnh? Đang chụp màn hình giải...";
        captureScreenAndSolve();
      }
    }
  }

  function openWidgetWithText(text) {
    if (!shadowRoot) return;
    ensureHudInsideFullscreen();
    const aiWindow = shadowRoot.getElementById("aiWindow");
    const promptInput = shadowRoot.getElementById("promptInput");
    const btnSendPrompt = shadowRoot.getElementById("btnSendPrompt");
    if (aiWindow) aiWindow.classList.add("visible");
    widgetVisible = true;
    if (promptInput) {
      promptInput.value = text;
      if (btnSendPrompt) btnSendPrompt.click();
    }
  }

  // ==========================================
  // THUẬT TOÁN TRÍCH XUẤT ĐÚNG CÂU HỎI & ĐÁP ÁN A/B/C/D TỪ DOM
  // ==========================================
  const QUESTION_CONTAINER_SELECTORS = [
    ".question-card",
    ".question-item",
    ".question-box",
    ".quiz-question",
    ".item-question",
    "[data-test='question-container']",
    "[class*='question-container']",
    "[class*='QuestionCard']",
    "[class*='question_item']",
    ".que",
    ".freebirdFormviewerComponentsQuestionBaseRoot",
    ".Qr7Oae",
    ".ant-card"
  ];

  function getCleanTextFromNode(node) {
    if (!node) return "";

    // Thu thập các dòng văn bản từ các phần tử con nhưng bỏ qua các thẻ hướng dẫn [data-wg-ignore] / .watermark-shield
    const ignoredElements = new Set();
    try {
      if (node.querySelectorAll) {
        node.querySelectorAll("[data-wg-ignore], .watermark-shield").forEach((el) => {
          ignoredElements.add(el);
        });
      }
    } catch (_) {}

    // Tạm ẩn các phần tử ignore (nếu có) để lấy innerText chuẩn xác có xuống dòng của trình duyệt
    const savedDisplays = [];
    ignoredElements.forEach((el) => {
      savedDisplays.push({ el, display: el.style.display });
      el.style.display = "none";
    });

    let raw = (node.innerText || node.textContent || "").trim();

    // Khôi phục lại hiển thị ban đầu ngay lập tức
    savedDisplays.forEach(({ el, display }) => {
      el.style.display = display;
    });

    try {
      const imgs = node.querySelectorAll("img[alt]");
      imgs.forEach((img) => {
        const alt = img.getAttribute("alt");
        if (alt && alt.trim().length > 1 && !raw.includes(alt.trim())) {
          raw += " " + alt.trim();
        }
      });

      const canvases =
        node.tagName === "CANVAS"
          ? [node]
          : Array.from(node.querySelectorAll ? node.querySelectorAll("canvas") : []);
      canvases.forEach((cv) => {
        const cvText = (cv.getAttribute("data-wg-canvas-text") || "").trim();
        if (cvText && !raw.includes(cvText)) {
          raw = (raw ? raw + "\n" : "") + cvText;
        }
      });
    } catch (_) {}

    return raw.replace(/\n{3,}/g, "\n\n").trim();
  }

  function findBestQuestionContainer(el) {
    if (!el || el === document.body || el === document.documentElement) return null;

    for (const sel of QUESTION_CONTAINER_SELECTORS) {
      try {
        const matched = el.closest(sel);
        if (matched) {
          const txt = getCleanTextFromNode(matched);
          if (txt.length >= 15 && txt.length <= 3500) {
            return matched;
          }
        }
      } catch (_) {}
    }

    let curr = el;
    let bestCandidate = el;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      const txt = getCleanTextFromNode(curr);
      const rect = curr.getBoundingClientRect();
      if (
        txt.length >= 25 &&
        txt.length <= 2200 &&
        rect.height >= 35 &&
        rect.height <= window.innerHeight * 0.92
      ) {
        bestCandidate = curr;
        const hasOptions =
          /(?:^|\n)\s*[A-D][\.\)\:\-]\s+/m.test(txt) ||
          curr.querySelectorAll(
            "input[type='radio'], input[type='checkbox'], label, [role='radio'], [role='option']"
          ).length >= 2;
        if (hasOptions && txt.length >= 35) {
          return curr;
        }
      }
      if (txt.length > 2500) break;
      curr = curr.parentElement;
    }

    return bestCandidate;
  }

  function extractQuestionFromElement(el) {
    const container = findBestQuestionContainer(el);
    if (!container) return null;
    const text = getCleanTextFromNode(container);
    return text.length >= 10 ? text : null;
  }

  function scanAllQuestionsOnPage() {
    const results = [];
    const seenTexts = new Set();

    for (const sel of QUESTION_CONTAINER_SELECTORS) {
      try {
        const nodes = document.querySelectorAll(sel);
        if (nodes.length > 0) {
          nodes.forEach((node) => {
            if (widgetContainer && widgetContainer.contains(node)) return;
            const txt = getCleanTextFromNode(node);
            if (txt.length >= 20 && txt.length <= 3000 && !seenTexts.has(txt)) {
              seenTexts.add(txt);
              const matchNum = txt.match(/(?:Câu|Question|Bài)\s*(\d+)/i);
              results.push({
                element: node,
                label: matchNum ? `Câu ${matchNum[1]}` : `Câu ${results.length + 1}`,
                text: txt
              });
            }
          });
          if (results.length > 0) return results;
        }
      } catch (_) {}
    }

    const allBlocks = Array.from(
      document.querySelectorAll("div, section, article, li, fieldset")
    );
    for (const block of allBlocks) {
      if (widgetContainer && widgetContainer.contains(block)) continue;
      const txt = getCleanTextFromNode(block);
      if (txt.length < 25 || txt.length > 1800) continue;

      const radios = block.querySelectorAll(
        "input[type='radio'], input[type='checkbox'], [role='radio']"
      );
      const hasQuestionPattern =
        /^(?:Câu|Question)\s*\d+/i.test(txt) ||
        (txt.includes("?") && /(?:^|\n)\s*[A-D][\.\)]/m.test(txt));

      if ((radios.length >= 2 && radios.length <= 6) || hasQuestionPattern) {
        if (radios.length > 6) continue;
        const isDuplicate = Array.from(seenTexts).some(
          (existing) => existing.includes(txt) || txt.includes(existing)
        );
        if (!isDuplicate) {
          seenTexts.add(txt);
          const matchNum = txt.match(/(?:Câu|Question)\s*(\d+)/i);
          results.push({
            element: block,
            label: matchNum ? `Câu ${matchNum[1]}` : `Câu ${results.length + 1}`,
            text: txt
          });
        }
      }
    }

    return results;
  }

  function findQuestionClosestToViewportCenter(questions) {
    if (!questions || questions.length === 0) return 0;
    const viewportCenterY = window.innerHeight / 2;
    let bestIdx = 0;
    let minDistance = Infinity;

    questions.forEach((q, idx) => {
      if (!q.element) return;
      const rect = q.element.getBoundingClientRect();
      const elementCenterY = rect.top + rect.height / 2;
      const dist = Math.abs(elementCenterY - viewportCenterY);
      if (dist < minDistance) {
        minDistance = dist;
        bestIdx = idx;
      }
    });

    return bestIdx;
  }

  // ==========================================
  // PHẦN 4: KÉO THẢ TỰ DO
  // ==========================================
  function makeDraggable(element) {
    let startX = 0,
      startY = 0,
      initialLeft = 0,
      initialTop = 0;

    element.onmousedown = (e) => {
      e = e || window.event;
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      const rect = element.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      document.onmouseup = () => {
        document.onmouseup = null;
        document.onmousemove = null;
      };

      document.onmousemove = (ev) => {
        ev = ev || window.event;
        ev.preventDefault();
        const deltaX = ev.clientX - startX;
        const deltaY = ev.clientY - startY;

        element.style.top = Math.max(0, initialTop + deltaY) + "px";
        element.style.left = Math.max(0, initialLeft + deltaX) + "px";
        element.style.bottom = "auto";
        element.style.right = "auto";
      };
    };
  }

  function makeDraggableWindow(winEl, headerEl) {
    let startX = 0,
      startY = 0,
      initialLeft = 0,
      initialTop = 0;

    headerEl.onmousedown = (e) => {
      e = e || window.event;
      if (e.target.closest("button") || e.target.closest("select")) return;
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;

      const rect = winEl.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      document.onmouseup = () => {
        document.onmouseup = null;
        document.onmousemove = null;
        sessionStorage.setItem("wg_win_top", winEl.style.top);
        sessionStorage.setItem("wg_win_left", winEl.style.left);
      };

      document.onmousemove = (ev) => {
        ev = ev || window.event;
        ev.preventDefault();
        const deltaX = ev.clientX - startX;
        const deltaY = ev.clientY - startY;

        winEl.style.top = Math.max(0, initialTop + deltaY) + "px";
        winEl.style.left = Math.max(0, initialLeft + deltaX) + "px";
        winEl.style.bottom = "auto";
        winEl.style.right = "auto";
      };
    };
  }
})();

    // Keyup listener panic close in content.js
    window.addEventListener(
      "keyup",
      (e) => {
        if (e.key === "Control" || e.code === "ControlLeft" || e.code === "ControlRight") {
          if (typeof isPickQuestionMode !== "undefined" && isPickQuestionMode) {
            stopPickQuestionMode();
          } else if (typeof widgetVisible !== "undefined" && widgetVisible) {
            closeWidget();
          }
        }
      },
      true
    );
