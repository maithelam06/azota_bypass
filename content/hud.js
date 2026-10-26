// content/hud.js
// Giao diện Shadow DOM HUD nổi, đổi model trực tiếp, thanh chọn câu & chế độ Chỉ câu

(function () {
  "use strict";

  const PROVIDER_MODELS = {
    groq: [
      { value: "llama-3.3-70b-versatile", label: "🧠 Llama 3.3 70B (Mạnh nhất - Chuẩn 10/10)" },
      { value: "deepseek-r1-distill-llama-70b", label: "🐳 DeepSeek R1 70B (Tư duy Toán/Lý/Hóa)" },
      { value: "meta-llama/llama-4-scout-17b-16e-instruct", label: "🚀 Llama 4 Scout (Llama 4 MoE)" },
      { value: "llama-3.1-8b-instant", label: "⚡ Llama 3.1 8B (Siêu tốc 0.1s)" }
    ],
    gemini: [
      { value: "gemini-3.1-pro-preview", label: "🧠 Gemini 3.1 Pro (Toán/Lý/Hóa khó - Chuẩn xác 10/10, Free 15 RPM)" },
      { value: "gemini-3.8-flash", label: "🚀 Gemini 3.8 Flash (Thông minh & Chuẩn hơn 3.5, Cực nhanh)" },
      { value: "gemini-3.5-flash-lite", label: "⚡ Gemini 3.5 Flash-Lite (Khuyên dùng: Siêu tốc 0.2s - Free Quota cao)" },
      { value: "gemini-4-argon", label: "🌟 Gemini 4 Argon (Gen 4 Frontier - AI Studio / Cần Billing)" },
      { value: "gemini-3.7-flash", label: "🔥 Gemini 3.7 Flash (Suy luận nhiều bước)" },
      { value: "gemini-3.6-flash", label: "✨ Gemini 3.6 Flash (Cân bằng tốc độ)" },
      { value: "gemini-3.5-flash", label: "💡 Gemini 3.5 Flash (Ổn định)" },
      { value: "gemini-3.1-flash-lite", label: "💨 Gemini 3.1 Flash-Lite (Siêu nhẹ)" },
      { value: "gemini-flash-latest", label: "🔄 Gemini Flash Latest (Tự lên bản mới)" },
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Key cũ)" }
    ],
    deepseek: [
      { value: "deepseek-chat", label: "🚀 DeepSeek V3 (deepseek-chat)" },
      { value: "deepseek-reasoner", label: "🧠 DeepSeek R1 (deepseek-reasoner)" }
    ],
    claude: [
      { value: "claude-3-7-sonnet-latest", label: "👑 Claude 3.7 Sonnet (Mạnh nhất thế giới 2026)" },
      { value: "claude-3-5-sonnet-latest", label: "🔥 Claude 3.5 Sonnet (Đỉnh cao toàn diện)" },
      { value: "claude-3-5-haiku-latest", label: "⚡ Claude 3.5 Haiku (Siêu tốc)" },
      { value: "claude-3-opus-latest", label: "🧠 Claude 3 Opus (Chuyên sâu)" }
    ],
    openrouter: [
      { value: "anthropic/claude-3.7-sonnet", label: "👑 Claude 3.7 Sonnet (OpenRouter)" },
      { value: "openai/o1", label: "🧠 OpenAI o1 (OpenRouter)" },
      { value: "openai/o3-mini", label: "⚡ OpenAI o3-mini (OpenRouter)" },
      { value: "deepseek/deepseek-r1", label: "🐳 DeepSeek R1 (OpenRouter)" },
      { value: "deepseek/deepseek-chat-v3-0324:free", label: "🧠 DeepSeek V3 0324 (FREE)" },
      { value: "deepseek/deepseek-r1:free", label: "🐳 DeepSeek R1 (FREE)" },
      { value: "openrouter/free", label: "🚀 Auto Free Router (Tự chọn model sống)" },
      { value: "meta-llama/llama-3.3-70b-instruct:free", label: "🔥 Llama 3.3 70B (FREE)" },
      { value: "google/gemma-3-27b-it:free", label: "⚡ Gemma 3 27B IT (FREE)" },
      { value: "qwen/qwen-2.5-72b-instruct:free", label: "💡 Qwen 2.5 72B (FREE)" },
      { value: "mistralai/mistral-small-3.1-24b-instruct:free", label: "✨ Mistral Small 3.1 (FREE)" }
    ],
    chatgpt: [
      { value: "o1", label: "🧠 o1 (Flagship Reasoning - Đỉnh cao OpenAI)" },
      { value: "o3-mini", label: "⚡ o3-mini (Tư duy STEM siêu tốc)" },
      { value: "gpt-4o", label: "🔥 GPT-4o (Toàn diện cao cấp)" },
      { value: "gpt-4.1-mini", label: "🚀 GPT-4.1 Mini (Thế hệ mới)" },
      { value: "gpt-4o-mini", label: "⚡ GPT-4o Mini (Nhanh & Chuẩn)" }
    ]
  };

  const opacityLevels = [1.0, 0.45, 0.2, 0.06];
  let currentOpacityIndex = 0;
  const OPACITY_PRESETS = [
    { label: "Mờ vừa phải (30%)", idle: 0.30, hover: 0.85, tooltip: 0.95 },
    { label: "Rõ nét (60%)", idle: 0.60, hover: 1.0, tooltip: 1.0 },
    { label: "Siêu mờ tàng hình (8%)", idle: 0.08, hover: 0.35, tooltip: 0.65 },
    { label: "Tối đa (100%)", idle: 0.90, hover: 1.0, tooltip: 1.0 }
  ];
  let currentPresetIndex = 0;
  let toastTimer = null;
  let isMiniMode = true;
  let isPickQuestionMode = false;
  let pickModeTimer = null;
  let autoScrollSolveEnabled = true;
  let autoClickEnabled = false;
  let lastAutoSolvedQuestionText = "";
  let activeQuestionTargetElement = null;
  let isCurrentlySolving = false;
  let currentSolveRequestId = 0;
  const solvedQuestionsCache = new Map();
  let glowTimeout = null;
  let widgetVisible = false;
  let shadowRoot = null;
  let widgetContainer = null;
  let scannedQuestionsList = [];

  window.__wgHud = {
    get widgetContainer() { return widgetContainer; },
    get shadowRoot() { return shadowRoot; },
    get widgetVisible() { return widgetVisible; },
    get isPickQuestionMode() { return isPickQuestionMode; },
    get autoScrollSolveEnabled() { return autoScrollSolveEnabled; },
    set autoScrollSolveEnabled(val) { this.toggleAutoScrollSolve(val); },
    get autoClickEnabled() { return autoClickEnabled; },
    set autoClickEnabled(val) { this.toggleAutoClick(val); },

    applyStealthOrbVisibility(isStealth) {
      if (!shadowRoot) return;
      const orb = shadowRoot.getElementById("orbBtn");
      if (orb) {
        if (isStealth) {
          orb.classList.add("hidden");
        } else {
          orb.classList.remove("hidden");
        }
      }
    },

    ensureHudInsideFullscreen() {
      if (!widgetContainer) return;
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
      const targetParent = fsEl || document.body || document.documentElement;
      if (targetParent && (!widgetContainer.parentNode || widgetContainer.parentNode !== targetParent || !widgetContainer.isConnected)) {
        try {
          targetParent.appendChild(widgetContainer);
        } catch (_) {
          if (document.documentElement && widgetContainer.parentNode !== document.documentElement) {
            document.documentElement.appendChild(widgetContainer);
          }
        }
      }
    },

    detectPageTheme() {
      try {
        const host = window.location.hostname.toLowerCase();
        if (host.includes("azota")) return "light";
        if (host.includes("quizizz") || host.includes("wayground")) {
          const bodyBg = window.getComputedStyle(document.body).backgroundColor;
          const rgb = bodyBg ? bodyBg.match(/\d+/g) : null;
          if (rgb && rgb.length >= 3) {
            const r = parseInt(rgb[0], 10), g = parseInt(rgb[1], 10), b = parseInt(rgb[2], 10);
            return ((r * 299 + g * 587 + b * 114) / 1000) > 135 ? "light" : "dark";
          }
          return "dark";
        }

        // Tự động nhận diện màu nền chính của trang
        let el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2) || document.body;
        while (el && el !== document.documentElement) {
          const bg = window.getComputedStyle(el).backgroundColor;
          if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") {
            const rgb = bg.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
              const r = parseInt(rgb[0], 10), g = parseInt(rgb[1], 10), b = parseInt(rgb[2], 10);
              return ((r * 299 + g * 587 + b * 114) / 1000) > 135 ? "light" : "dark";
            }
          }
          el = el.parentElement;
        }

        const bodyBg = window.getComputedStyle(document.body).backgroundColor;
        const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
        const bg = (bodyBg && bodyBg !== "rgba(0, 0, 0, 0)" && bodyBg !== "transparent") ? bodyBg : htmlBg;
        const rgb = bg ? bg.match(/\d+/g) : null;
        if (rgb && rgb.length >= 3) {
          const r = parseInt(rgb[0], 10), g = parseInt(rgb[1], 10), b = parseInt(rgb[2], 10);
          return ((r * 299 + g * 587 + b * 114) / 1000) > 135 ? "light" : "dark";
        }
      } catch (_) {}
      return "light";
    },

    applyTheme() {
      if (!shadowRoot) return;
      const theme = this.detectPageTheme();
      const wrapEl = shadowRoot.getElementById("hudWrapper");
      if (wrapEl) {
        wrapEl.classList.remove("theme-light", "theme-dark");
        wrapEl.classList.add(theme === "light" ? "theme-light" : "theme-dark");
      }
    },

    bindOrbEyeButton() {
      if (!shadowRoot) return;
      const eyeBtn = shadowRoot.getElementById("orbEyeBtn");
      if (eyeBtn) {
        eyeBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.cycleOrbOpacity();
        };
      }
    },

    showOpacityToast(text) {
      if (!shadowRoot) return;
      const toast = shadowRoot.getElementById("opacityToast");
      const orb = shadowRoot.getElementById("orbBtn");
      if (!toast || !orb) return;
      const rect = orb.getBoundingClientRect();
      toast.style.left = `${Math.round(rect.left + rect.width / 2)}px`;
      toast.style.top = `${Math.round(Math.max(8, rect.top - 28))}px`;
      toast.textContent = text;
      toast.classList.add("visible");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toast.classList.remove("visible");
      }, 1200);
    },

    applyOrbOpacityPreset(idx = currentPresetIndex, showToast = true, save = true) {
      if (idx < 0 || idx >= OPACITY_PRESETS.length) idx = 0;
      currentPresetIndex = idx;
      const p = OPACITY_PRESETS[currentPresetIndex];

      if (shadowRoot) {
        const wrapEl = shadowRoot.getElementById("hudWrapper");
        const orb = shadowRoot.getElementById("orbBtn");
        const eyeVal = shadowRoot.getElementById("orbEyeVal");

        if (wrapEl) {
          wrapEl.style.setProperty("--orb-idle-op", String(p.idle));
          wrapEl.style.setProperty("--orb-hover-op", String(p.hover));
          wrapEl.style.setProperty("--tooltip-op", String(p.tooltip));
        }

        if (orb) {
          if (orb.matches(":hover")) {
            orb.style.opacity = String(p.hover);
          } else {
            orb.style.opacity = String(p.idle);
          }
        }

        if (eyeVal) {
          eyeVal.textContent = `${Math.round(p.hover * 100)}%`;
        }

        if (showToast) {
          this.showOpacityToast(`👁️ ${p.label}`);
        }
      }

      if (save) {
        try {
          chrome.storage.local.set({ orbOpacityPresetIdx: currentPresetIndex });
        } catch (_) {}
      }
    },

    cycleOrbOpacity() {
      const nextIdx = (currentPresetIndex + 1) % OPACITY_PRESETS.length;
      this.applyOrbOpacityPreset(nextIdx, true, true);
    },

    initUI() {
      if (window !== window.top) return;
      if (widgetContainer && shadowRoot) {
        this.ensureHudInsideFullscreen();
        return;
      }
      if (!document.documentElement && !document.body) return;

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
      this.ensureHudInsideFullscreen();

      shadowRoot = widgetContainer.attachShadow({ mode: "open" });

      const style = document.createElement("style");
      style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }

        .pick-highlight-overlay {
          position: fixed;
          pointer-events: none;
          border: 1.5px solid rgba(255, 255, 255, 0.65);
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          z-index: 2147483646;
          transition: all 0.05s ease;
          display: none;
          box-shadow: none;
        }
        .theme-light .pick-highlight-overlay {
          border: 1.5px solid rgba(15, 23, 42, 0.35);
          background: rgba(15, 23, 42, 0.03);
          box-shadow: none;
        }
        .theme-dark .pick-highlight-overlay {
          border: 1.5px solid rgba(255, 255, 255, 0.65);
          background: rgba(255, 255, 255, 0.05);
          box-shadow: none;
        }
        .pick-highlight-label {
          display: none !important;
        }
        .pick-banner {
          position: fixed;
          top: 14px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(15, 23, 42, 0.88);
          color: #f1f5f9;
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          z-index: 2147483647;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
          display: none;
          align-items: center;
          gap: 10px;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(148, 163, 184, 0.25);
          animation: pickBannerDrop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          user-select: none;
          letter-spacing: -0.1px;
        }
        .theme-light .pick-banner {
          background: rgba(255, 255, 255, 0.94);
          color: #0f172a;
          border: 1px solid rgba(148, 163, 184, 0.35);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1);
        }
        .pick-banner.visible { display: flex !important; }
        .pick-cancel-btn {
          background: rgba(148, 163, 184, 0.2);
          border: 1px solid rgba(148, 163, 184, 0.35);
          color: inherit;
          border-radius: 12px;
          padding: 2px 10px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .pick-cancel-btn:hover {
          background: rgba(239, 68, 68, 0.85);
          border-color: #ef4444;
          color: #fff;
        }

        .floating-orb {
            position: fixed;
            bottom: 85px;
            right: 24px;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: 1.5px solid rgba(56, 189, 248, 0.7);
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: grab;
            z-index: 2147483647;
            transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
            user-select: none;
            backdrop-filter: blur(8px);
            opacity: var(--orb-idle-op, 0.30);
            touch-action: none;
          }
          .floating-orb.dragging {
            cursor: grabbing !important;
            transition: none !important;
          }
        .floating-orb:hover {
          opacity: var(--orb-hover-op, 0.35) !important;
          transform: scale(1.12);
        }
        .floating-orb:active { cursor: grabbing; }
        .floating-orb svg { width: 18px; height: 18px; fill: #38bdf8; transition: fill 0.2s; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3)); }
        .floating-orb:hover svg { fill: #7dd3fc; }
        .floating-orb.hidden { display: none !important; }

        /* Trạng thái AI đang giải đề (Micro spinner) */
        .floating-orb.solving {
          border-color: #fbbf24 !important;
          box-shadow: 0 0 10px rgba(251, 191, 36, 0.7) !important;
        }
        .floating-orb.solving .orb-icon { display: none !important; }
        .floating-orb.solving .orb-spinner {
          display: block !important;
          width: 13px;
          height: 13px;
          border: 2px solid rgba(251, 191, 36, 0.25);
          border-top-color: #fbbf24;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        /* Trạng thái Báo đáp án bằng icon ở góc màn hình (Chỉ hiển thị đáp án khi rê chuột vào - Stealth) */
        .floating-orb.has-answer {
          cursor: pointer;
        }

        /* Chấm xanh nhỏ tinh tế ở góc trên orb báo hiệu AI đã có đáp án sẵn sàng */
        .floating-orb.has-answer::after {
          content: "";
          position: absolute;
          top: -1px;
          right: -1px;
          width: 7px;
          height: 7px;
          background: #10b981;
          border: 1.5px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 6px rgba(16, 185, 129, 0.9);
          pointer-events: none;
          transition: opacity 0.15s ease, transform 0.15s ease;
          animation: orbReadyDotPulse 1.8s ease-in-out infinite alternate;
        }
        .theme-light .floating-orb.has-answer::after {
          background: rgba(16, 185, 129, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.6);
          box-shadow: 0 0 3px rgba(16, 185, 129, 0.3);
          opacity: 0.55;
          animation: none;
        }

        @keyframes orbReadyDotPulse {
          0% { transform: scale(0.9); opacity: 0.85; }
          100% { transform: scale(1.2); opacity: 1; box-shadow: 0 0 8px rgba(16, 185, 129, 1); }
        }

        @keyframes orbReadyPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }

        /* Khi CHƯA rê chuột: Giữ nguyên icon tia sét và giao diện tàng hình */
        .floating-orb.has-answer:not(:hover) .orb-icon {
          display: flex !important;
        }
        .theme-dark .floating-orb.has-answer:not(:hover) svg,
        .floating-orb.has-answer:not(:hover) svg {
          fill: #34d399 !important;
        }
        .theme-light .floating-orb.has-answer:not(:hover) svg {
          fill: #64748b !important;
        }
        .floating-orb.has-answer:not(:hover) .orb-letter {
          display: none !important;
        }
        .floating-orb.has-answer:not(:hover) .orb-spinner {
          display: none !important;
        }

        /* KHI DI CHUỘT VÀO: MỚI HIỂN THỊ LÊN ĐÁP ÁN (BỚT MÀU - CHỈ THẤY CHỮ) */
        .floating-orb.has-answer:hover {
          opacity: var(--orb-hover-op, 0.35) !important;
          background: rgba(15, 23, 42, 0.9) !important;
          border-color: rgba(148, 163, 184, 0.45) !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25) !important;
          transform: scale(1.14);
          animation: orbAnswerPop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both !important;
        }
        .theme-light .floating-orb.has-answer:hover {
          background: rgba(255, 255, 255, 0.92) !important;
          border-color: rgba(148, 163, 184, 0.3) !important;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08) !important;
        }
        .floating-orb.has-answer:hover::after {
          display: none !important;
          opacity: 0 !important;
          transform: scale(0) !important;
        }
        .floating-orb.has-answer:hover .orb-icon {
          display: none !important;
        }
        .floating-orb.has-answer:hover .orb-spinner {
          display: none !important;
        }
        .floating-orb.has-answer:hover .orb-letter {
          display: flex !important;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          font-size: 14px;
          font-weight: 800;
          color: #ffffff !important;
          line-height: 1;
          letter-spacing: -0.3px;
          text-shadow: none !important;
        }
        .theme-light .floating-orb.has-answer:hover .orb-letter {
          color: #334155 !important;
          text-shadow: none !important;
        }

        .orb-icon { display: flex; align-items: center; justify-content: center; }
        .orb-letter { display: none; }
        .orb-spinner { display: none; }

        /* Tooltip khi rê chuột vào icon nhỏ ở góc màn hình */
        .orb-tooltip {
          position: absolute;
          bottom: 30px;
          right: 0;
          border-radius: 9px;
          padding: 6px 10px;
          font-size: 11px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transform: translateY(3px);
          transition: opacity 0.18s ease, transform 0.18s ease;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          z-index: 2147483647;
          line-height: 1.4;
          max-width: 240px;
          letter-spacing: -0.1px;
        }
        .orb-tooltip::before {
          content: "";
          position: absolute;
          bottom: -10px;
          left: 0;
          right: 0;
          height: 10px;
          background: transparent;
        }
        .floating-orb:hover .orb-tooltip {
          opacity: var(--tooltip-op, 0.75);
          transform: translateY(0);
          pointer-events: auto;
        }

        .orb-tooltip-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          margin-bottom: 2px;
        }
        .orb-tooltip-title {
          font-weight: 700;
          font-size: 11.5px;
          line-height: 1.3;
        }
        .orb-eye-btn {
          background: rgba(148, 163, 184, 0.18);
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 10px;
          cursor: pointer;
          color: inherit;
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-weight: 600;
          transition: all 0.15s ease;
          line-height: 1.2;
          user-select: none;
        }
        .orb-eye-btn:hover {
          background: rgba(56, 189, 248, 0.25);
          border-color: #38bdf8;
          color: #38bdf8;
          transform: scale(1.05);
        }
        .orb-eye-btn:active {
          transform: scale(0.96);
        }
        .orb-tooltip-letter {
          font-weight: 800;
          font-size: 12.5px;
        }
        .orb-tooltip-snippet {
          font-size: 10.5px;
          max-width: 210px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin-bottom: 2px;
          opacity: 0.9;
          line-height: 1.35;
        }
        .orb-tooltip-hint {
          font-size: 10px;
          opacity: 0.75;
          font-weight: 500;
        }

        /* Tooltip Dark Theme */
        .theme-dark .orb-tooltip, .orb-tooltip {
          background: rgba(15, 23, 42, 0.75) !important;
          border: 1px solid rgba(148, 163, 184, 0.25) !important;
          color: #f1f5f9 !important;
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35) !important;
        }
        .theme-dark .orb-tooltip-title, .orb-tooltip-title { color: #f8fafc !important; }
        .theme-dark .orb-tooltip-letter, .orb-tooltip-letter { color: #38bdf8 !important; }
        .theme-dark .orb-tooltip-snippet, .orb-tooltip-snippet { color: #94a3b8 !important; }
        .theme-dark .orb-tooltip-hint, .orb-tooltip-hint { color: #64748b !important; }

        /* Tooltip Light Theme */
        .theme-light .orb-tooltip {
          background: rgba(255, 255, 255, 0.88) !important;
          border: 1px solid rgba(203, 213, 225, 0.5) !important;
          color: #334155 !important;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06) !important;
        }
        .theme-light .orb-tooltip-title { color: #1e293b !important; }
        .theme-light .orb-tooltip-letter { color: #0284c7 !important; }
        .theme-light .orb-tooltip-snippet { color: #64748b !important; }
        .theme-light .orb-tooltip-hint { color: #94a3b8 !important; }

        /* Toast thông báo độ mờ mini */
        .opacity-toast {
          position: fixed;
          background: rgba(15, 23, 42, 0.95);
          color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.4);
          padding: 3px 9px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          pointer-events: none;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
          opacity: 0;
          transform: translate(-50%, 0);
          transition: opacity 0.18s ease, transform 0.18s ease;
          z-index: 2147483647;
          letter-spacing: -0.1px;
        }
        .opacity-toast.visible {
          opacity: 1;
          transform: translate(-50%, -4px);
        }

        @keyframes orbAnswerPop {
          0% { transform: scale(0.9); opacity: 0.7; }
          60% { transform: scale(1.24); }
          100% { transform: scale(1.18); opacity: 1; }
        }

        /* PHỐI HỢP TÔNG MÀU THEO TRANG WEB */
        .theme-dark .floating-orb, .floating-orb {
          background: linear-gradient(135deg, #0b1120, #1e293b);
          border-color: rgba(56, 189, 248, 0.7);
        }
        .theme-dark .floating-orb svg, .floating-orb svg { fill: #38bdf8; }

        .theme-light .floating-orb {
          background: rgba(248, 250, 252, 0.75);
          border-color: rgba(148, 163, 184, 0.25);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }
        .theme-light .floating-orb svg { fill: #94a3b8; }
        .theme-light .opacity-toast {
          background: rgba(255, 255, 255, 0.95);
          color: #0284c7;
          border-color: rgba(148, 163, 184, 0.35);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        /* Giao diện HUD nền sáng khi ở trang trắng */
        .theme-light .ai-window {
          background: rgba(255, 255, 255, 0.98);
          border: 1px solid #cbd5e1;
          color: #0f172a;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
        }
        .theme-light .window-header {
          background: rgba(241, 245, 249, 0.98);
          border-bottom: 1px solid #cbd5e1;
        }
        .theme-light .header-title { color: #334155; }
        .theme-light .btn-tool { color: #475569; }
        .theme-light .btn-tool:hover { background: #e2e8f0; color: #0f172a; }
        .theme-light .question-card {
          background: #f8fafc;
          border-color: rgba(59, 130, 246, 0.35);
        }
        .theme-light .question-full-text { color: #1e293b; }
        .theme-light .prompt-box {
          background: #ffffff;
          color: #0f172a;
          border-color: #3b82f6;
        }
        .theme-light .result-container {
          background: #f0fdf4;
          border-color: rgba(16, 185, 129, 0.5);
          box-shadow: 0 4px 16px rgba(16, 185, 129, 0.12);
        }
        .theme-light .answer-badge-wrap {
          background: #ffffff;
          border-color: rgba(59, 130, 246, 0.3);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
        .theme-light .answer-badge-text { color: #0f172a; }
        .theme-light .result-box {
          background: #ffffff;
          color: #334155;
          border-color: #e2e8f0;
        }
        .theme-light .status-footer {
          background: #f1f5f9;
          border-top: 1px solid #e2e8f0;
          color: #64748b;
        }
        .theme-light .model-bar {
          background: #f8fafc;
          border-color: #cbd5e1;
        }
        .theme-light .hud-select {
          background: #ffffff;
          color: #0f172a;
          border-color: #cbd5e1;
        }
        .theme-light .action-btn {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #334155;
        }
        .theme-light .action-btn:hover {
          background: #e2e8f0;
          color: #0f172a;
        }

        .ai-window {
          position: fixed;
          bottom: 46px;
          right: 14px;
          width: 295px;
          max-width: calc(100vw - 16px);
          background: rgba(13, 19, 33, 0.98);
          border: 1px solid #334155;
          border-radius: 10px;
          box-shadow: 0 10px 32px rgba(0, 0, 0, 0.65);
          color: #f1f5f9;
          display: none;
          flex-direction: column;
          z-index: 2147483647;
          overflow: hidden;
          backdrop-filter: blur(12px);
          transition: opacity 0.2s, width 0.25s;
        }
        .ai-window.visible { display: flex; }
        .ai-window.compact-tools .tools-collapsible { display: none !important; }
        .ai-window.mini-mode { width: 295px; }
        .ai-window.mini-mode .status-footer { display: none !important; }
        .ai-window.mini-mode .shield-badge { display: none; }
        .ai-window.mini-mode .act-lbl { display: none; }
        .ai-window.mini-mode .action-btn { font-size: 11.5px; padding: 4px 0; line-height: 1.25; }
        .ai-window.mini-mode .hud-select-provider { flex: 0 0 74px; }
        .ai-window.mini-mode .hud-select { font-size: 11px; padding: 2px 4px; }
        .ai-window.mini-mode .btn-tool { padding: 2px 4px; }
        .ai-window.mini-mode .window-body { max-height: calc(100vh - 60px); }
        .ai-window.mini-mode .question-full-text { max-height: 100px; }
        .ai-window.mini-mode .result-box { max-height: 170px; }
        .ai-window.mini-mode .answer-sheet-body { max-height: 190px; }
        .ai-window.mini-mode .question-pills { max-height: 48px; }
        .ai-window.mini-mode .mini-status { display: block; }
        .mini-status { display: none; font-size: 10.5px; font-weight: 500; color: #94a3b8; text-align: right; padding: 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ai-window.full-mode { width: 345px; }
        .ai-window.full-mode .status-footer { display: flex !important; }

        .window-header {
          padding: 6px 10px;
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
          font-weight: 700;
          font-size: 12px;
          color: #cbd5e1;
          letter-spacing: -0.2px;
        }
        .shield-badge {
          font-size: 10px;
          font-weight: 600;
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.3);
          padding: 1.5px 5px;
          border-radius: 4px;
        }
        .header-tools { display: flex; align-items: center; gap: 3px; }
        .btn-tool {
          background: transparent;
          border: 1px solid transparent;
          color: #94a3b8;
          cursor: pointer;
          padding: 2px 5px;
          border-radius: 4px;
          font-size: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.12s;
        }
        .btn-tool:hover { background: #334155; color: #fff; border-color: #475569; }
        .btn-tool.active-tool { background: rgba(56, 189, 248, 0.2); border-color: #38bdf8; color: #38bdf8; }

        .window-body {
          padding: 6px 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: calc(100vh - 70px);
          overflow-y: auto;
          scrollbar-width: thin;
        }
        .tools-collapsible { display: flex; flex-direction: column; gap: 5px; }
        .model-bar {
          display: flex;
          gap: 4px;
          align-items: center;
          background: #0b1120;
          border: 1px solid #1e293b;
          border-radius: 6px;
          padding: 3px 5px;
        }
        .hud-select {
          background: #1e293b;
          color: #f1f5f9;
          border: 1px solid #334155;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          padding: 3px 5px;
          outline: none;
          cursor: pointer;
        }
        .hud-select-provider { flex: 0 0 90px; }
        .hud-select-model { flex: 1; min-width: 0; }
        .btn-key-toggle {
          background: #1e293b;
          border: 1px solid #334155;
          color: #fbbf24;
          border-radius: 4px;
          font-size: 11px;
          padding: 3px 5px;
          cursor: pointer;
        }
        .btn-key-toggle:hover { background: #334155; }
        .key-inline-box {
          display: none;
          gap: 4px;
          align-items: center;
          background: #090d16;
          border: 1px solid #334155;
          border-radius: 5px;
          padding: 4px 6px;
        }
        .key-inline-box.visible { display: flex; }
        .key-inline-input {
          flex: 1;
          background: #1e293b;
          border: 1px solid #475569;
          color: #fff;
          font-size: 11px;
          font-family: 'JetBrains Mono', Consolas, monospace;
          padding: 3px 6px;
          border-radius: 4px;
          outline: none;
        }
        .btn-key-save {
          background: #10b981;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .action-bar { display: grid; grid-template-columns: repeat(6, 1fr); gap: 3px; }
        .action-btn {
          padding: 5px 2px;
          text-align: center;
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 6px;
          color: #cbd5e1;
          font-size: 10.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
          letter-spacing: -0.1px;
        }
        .action-btn:hover { background: #334155; color: #fff; border-color: #38bdf8; }
        .action-btn.active-pick { background: rgba(16, 185, 129, 0.25); border-color: #10b981; color: #34d399; }
        .action-btn.active-scroll {
          background: rgba(6, 182, 212, 0.28);
          border-color: #06b6d4;
          color: #22d3ee;
          box-shadow: 0 0 10px rgba(6, 182, 212, 0.4);
          animation: pulseGlow 1.8s infinite alternate;
        }
        .action-btn.active-click {
          background: rgba(16, 185, 129, 0.28);
          border-color: #10b981;
          color: #34d399;
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
          animation: clickGlow 1.8s infinite alternate;
        }
        @keyframes pulseGlow { from { box-shadow: 0 0 4px rgba(6, 182, 212, 0.3); } to { box-shadow: 0 0 12px rgba(6, 182, 212, 0.6); } }
        @keyframes clickGlow { from { box-shadow: 0 0 4px rgba(16, 185, 129, 0.3); } to { box-shadow: 0 0 12px rgba(16, 185, 129, 0.6); } }

        .auto-scroll-glow-overlay {
          position: fixed;
          pointer-events: none;
          border: 1.5px solid rgba(6, 182, 212, 0.25);
          background: rgba(6, 182, 212, 0.03);
          border-radius: 8px;
          z-index: 2147483645;
          transition: opacity 0.4s ease;
          display: none;
        }
        .auto-scroll-badge { display: none !important; }

        .question-pills {
          display: none;
          flex-wrap: wrap;
          gap: 3px;
          max-height: 54px;
          overflow-y: auto;
          padding: 4px;
          background: #0b1120;
          border: 1px solid #1e293b;
          border-radius: 6px;
          align-items: center;
        }
        .question-pills.visible { display: flex; }
        .pills-label { font-size: 10px; font-weight: 600; color: #64748b; margin-right: 2px; white-space: nowrap; }
        .q-pill {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 4px;
          color: #cbd5e1;
          font-size: 10.5px;
          font-weight: 600;
          padding: 2px 6px;
          cursor: pointer;
          transition: all 0.12s;
        }
        .q-pill:hover { background: #334155; color: #fff; border-color: #38bdf8; }
        .q-pill.active { background: #2563eb; border-color: #60a5fa; color: #fff; }
        .q-pill.solved { border-color: #10b981; }
        .q-pill.solved::after { content: "\\2713"; font-size: 8px; margin-left: 3px; color: #34d399; }

        /* BẢNG ĐÁP ÁN TỰ ĐỘNG */
        .answer-sheet {
          display: none;
          flex-direction: column;
          gap: 0;
          background: #020617;
          border: 1px solid #1e293b;
          border-radius: 8px;
          overflow: hidden;
        }
        .answer-sheet.visible { display: flex; }
        .answer-sheet-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 5px 8px;
          background: #0b1120;
          border-bottom: 1px solid #1e293b;
        }
        .answer-sheet-title { font-size: 11px; font-weight: 700; color: #38bdf8; }
        .answer-sheet-actions { display: flex; gap: 4px; }
        .btn-sheet-action {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 4px;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          cursor: pointer;
        }
        .btn-sheet-action:hover { background: #334155; color: #fff; }
        .answer-sheet-body { max-height: 220px; overflow-y: auto; scrollbar-width: thin; }
        .answer-sheet-row {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border-bottom: 1px solid rgba(30, 41, 59, 0.7);
          cursor: pointer;
          transition: background 0.1s;
        }
        .answer-sheet-row:hover { background: rgba(30, 41, 59, 0.6); }
        .answer-sheet-row:last-child { border-bottom: none; }
        .as-num { font-size: 10px; font-weight: 700; color: #64748b; min-width: 28px; flex-shrink: 0; }
        .as-badge {
          font-size: 12px;
          font-weight: 800;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 5px;
          flex-shrink: 0;
          color: #fff;
        }
        .as-badge.letter-A { background: #2563eb; }
        .as-badge.letter-B { background: #7c3aed; }
        .as-badge.letter-C { background: #d97706; }
        .as-badge.letter-D { background: #dc2626; }
        .as-badge.letter-E { background: #059669; }
        .as-badge.letter-F { background: #0891b2; }
        .as-badge.loading { background: #334155; animation: asPulse 0.8s infinite alternate; }
        @keyframes asPulse { from { opacity: 0.4; } to { opacity: 1; } }
        .as-text { font-size: 11px; font-weight: 500; color: #cbd5e1; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.35; }
        .as-progress { font-size: 10px; font-family: 'JetBrains Mono', Consolas, monospace; color: #64748b; margin-left: auto; flex-shrink: 0; }

        /* KHỐI CÂU HỎI */
        .question-card {
          background: #060a12;
          border: 1.5px solid rgba(56, 189, 248, 0.3);
          border-radius: 8px;
          padding: 6px 9px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .question-card-header { display: flex; justify-content: space-between; align-items: center; }
        .q-card-title {
          font-size: 11.5px;
          font-weight: 700;
          color: #38bdf8;
          display: flex;
          align-items: center;
          gap: 5px;
          letter-spacing: -0.1px;
        }
        .q-card-badge-auto {
          font-size: 10px;
          background: rgba(6, 182, 212, 0.2);
          color: #22d3ee;
          border: 1px solid rgba(6, 182, 212, 0.4);
          padding: 1px 5px;
          border-radius: 4px;
          font-weight: 700;
        }
        .q-card-tools { display: flex; align-items: center; gap: 4px; }
        .btn-card-tool {
          background: #1e293b;
          border: 1px solid #334155;
          color: #94a3b8;
          border-radius: 4px;
          font-size: 10.5px;
          font-weight: 600;
          padding: 2px 7px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-card-tool:hover { background: #334155; color: #fff; }
        .question-full-text {
          font-size: 12.5px;
          line-height: 1.55;
          font-weight: 450;
          color: #f8fafc;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 115px;
          overflow-y: auto;
          scrollbar-width: thin;
          padding: 2px 1px;
        }
        .prompt-box {
          width: 100%;
          min-height: 44px;
          max-height: 115px;
          background: #0b1120;
          border: 1px dashed #38bdf8;
          border-radius: 6px;
          padding: 5px 7px;
          color: #f1f5f9;
          font-size: 12.5px;
          line-height: 1.55;
          font-weight: 450;
          resize: vertical;
          outline: none;
          display: none;
        }
        .btn-turbo-solve {
          width: 100%;
          padding: 5px 10px;
          background: linear-gradient(135deg, #2563eb, #0891b2);
          border: none;
          border-radius: 6px;
          color: white;
          font-weight: 700;
          font-size: 11.5px;
          cursor: pointer;
          letter-spacing: -0.1px;
        }
        .btn-turbo-solve:hover { opacity: 0.92; }

        /* KHỐI KẾT QUẢ HIỂN THỊ */
        .result-container {
          display: flex;
          flex-direction: column;
          gap: 5px;
          background: #020617;
          border: 1.5px solid rgba(16, 185, 129, 0.4);
          border-radius: 8px;
          padding: 7px 9px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
          animation: resultFadeIn 0.25s ease-out;
        }
        @keyframes resultFadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(51, 65, 85, 0.6);
          padding-bottom: 4px;
        }
        .result-title {
          font-size: 11px;
          font-weight: 700;
          color: #34d399;
          display: flex;
          align-items: center;
          gap: 4px;
          letter-spacing: 0.2px;
        }
        .result-actions { display: flex; gap: 4px; }
        .btn-copy-ans {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 4px;
          color: #cbd5e1;
          font-size: 10.5px;
          padding: 2px 7px;
          cursor: pointer;
          transition: all 0.15s;
          font-weight: 600;
        }
        .btn-copy-ans:hover { background: #334155; color: #fff; border-color: #38bdf8; }

        /* ĐÁP ÁN NỔI BẬT */
        .answer-badge-wrap {
          display: none;
          align-items: center;
          gap: 9px;
          padding: 7px 10px;
          background: rgba(15, 23, 42, 0.95);
          border: 1.5px solid rgba(148, 163, 184, 0.35);
          border-radius: 8px;
          margin-top: 2px;
          box-shadow: 0 3px 12px rgba(0, 0, 0, 0.25);
        }
        .theme-light .answer-badge-wrap {
          background: #ffffff;
          border-color: rgba(148, 163, 184, 0.4);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
        .answer-badge-wrap.visible { display: flex; }
        .answer-letter {
          font-size: 20px;
          font-weight: 800;
          line-height: 1;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: rgba(30, 41, 59, 0.85);
          border: 1.5px solid rgba(148, 163, 184, 0.45);
          color: #f8fafc;
          box-shadow: none;
          animation: answerPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          flex-shrink: 0;
        }
        .theme-light .answer-letter {
          background: #f1f5f9;
          border-color: #cbd5e1;
          color: #0f172a;
        }
        @keyframes answerPop { from { transform: scale(0.4) rotate(-10deg); opacity: 0; } to { transform: scale(1) rotate(0deg); opacity: 1; } }
        .answer-badge-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
        .answer-badge-label { font-size: 10px; color: #34d399; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; }
        .answer-badge-text { font-size: 13px; color: #f8fafc; font-weight: 600; line-height: 1.45; word-break: break-word; }

        .result-box {
          font-size: 12.5px;
          line-height: 1.6;
          color: #cbd5e1;
          font-weight: 400;
          max-height: 170px;
          overflow-y: auto;
          white-space: pre-wrap;
          word-break: break-word;
          scrollbar-width: thin;
          padding: 7px 9px;
          background: rgba(11, 17, 32, 0.65);
          border-radius: 6px;
          border: 1px solid rgba(51, 65, 85, 0.5);
        }
        .loading-spinner {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #fbbf24;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 4px;
        }
        .spinner {
          width: 15px;
          height: 15px;
          border: 2.5px solid rgba(251, 191, 36, 0.25);
          border-top-color: #fbbf24;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .status-footer {
          padding: 5px 10px;
          background: #0b1120;
          border-top: 1px solid #1e293b;
          font-size: 11px;
          font-weight: 500;
          color: #64748b;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        kbd {
          background: #1e293b;
          border: 1px solid #475569;
          border-radius: 3px;
          padding: 1px 4px;
          color: #fbbf24;
          font-family: 'JetBrains Mono', Consolas, monospace;
          font-size: 10px;
          font-weight: 600;
        }
      `;

      shadowRoot.appendChild(style);

      const wrapper = document.createElement("div");
      wrapper.id = "hudWrapper";
      wrapper.innerHTML = `
        <div class="pick-highlight-overlay" id="pickOverlay"><div class="pick-highlight-label">👆 Click chuột trái để giải câu hỏi này</div></div>
        <div class="pick-banner" id="pickBanner">
          <span>🎯 Di chuột vào câu hỏi cần giải rồi <strong>CLICK CHUỘT TRÁI</strong></span>
          <button class="pick-cancel-btn" id="btnCancelPick" title="Thoát chế độ Chỉ câu">✕ Hủy (Alt+S)</button>
        </div>
        <div class="auto-scroll-glow-overlay" id="autoScrollGlow"><div class="auto-scroll-badge" id="autoScrollBadge">📜 Đang tự tra câu hỏi này...</div></div>
        <div class="floating-orb" id="orbBtn" title="Way & Azota AI (Alt+Q giải | Chuột phải/Cuộn: Chỉnh độ mờ)">
          <div class="orb-icon" id="orbIcon"><svg viewBox="0 0 24 24"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg></div>
          <div class="orb-letter" id="orbLetter"></div>
          <div class="orb-spinner" id="orbSpinner"></div>
          <div class="orb-tooltip" id="orbTooltip">
            <div class="orb-tooltip-header">
              <div class="orb-tooltip-title">⚡ Way & Azota</div>
              <button class="orb-eye-btn" id="orbEyeBtn" title="Chỉnh độ mờ (Bấm để đổi: 5% ➔ 12% ➔ 25% ➔ 60%)">👁️ <span class="orb-eye-val" id="orbEyeVal">5%</span></button>
            </div>
            <div class="orb-tooltip-hint">Click: Mở | 👁️: Đổi độ mờ (Cuộn/Chuột phải)</div>
          </div>
        </div>
        <div class="opacity-toast" id="opacityToast">👁️ 10%</div>
        <div class="ai-window compact-tools mini-mode" id="aiWindow">
          <div class="window-header" id="dragHeader" title="Giữ chuột vào đây để kéo di chuyển">
            <div class="header-title">
              <span>👑 Way & Azota Pro</span>
              <span id="siteBadge" class="shield-badge" style="background: rgba(16, 185, 129, 0.2); border-color: #10b981; color: #34d399;">🌐 Auto</span>
              <span class="shield-badge">🛡️ Stealth</span>
            </div>
            <div class="header-tools">
              <button class="btn-tool" id="btnToggleHelp" title="Xem Tóm tắt chức năng & Hướng dẫn sử dụng (HDSD)">❓</button>
              <button class="btn-tool" id="btnToggleTools" title="Bật/Tắt thanh công cụ phụ">🛠️</button>
              <button class="btn-tool" id="btnToggleMini" title="Mở rộng khung">📐</button>
              <button class="btn-tool" id="btnToggleOpacity" title="Đổi độ mờ trong suốt">👁️</button>
              <button class="btn-tool" id="minimizeBtn" title="Đóng nhanh (Bấm phím Esc hoặc Alt+H)">✕</button>
            </div>
          </div>
          <div class="hud-help-modal" id="hudHelpModal" style="display: none; background: #0b1120; border-bottom: 1px solid #334155; padding: 12px; font-size: 11.5px; color: #cbd5e1; max-height: 250px; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-weight: 700; color: #38bdf8; font-size: 12px; letter-spacing: -0.1px;">📖 HDSD - WAYGROUND & AZOTA PRO</span>
              <button id="btnCloseHelp" style="background: none; border: none; color: #94a3b8; font-size: 14px; cursor: pointer; padding: 2px 4px;">✕</button>
            </div>
            <div style="line-height: 1.55; display: flex; flex-direction: column; gap: 8px;">
              <div style="background: rgba(30, 41, 59, 0.7); padding: 7px 10px; border-radius: 6px; border-left: 3px solid #3b82f6;">
                <strong style="color: #60a5fa;">🎯 Cách Giải Câu Hỏi Chữ & Ảnh:</strong><br>
                1. <strong>Câu hỏi chữ:</strong> Bôi đen câu hỏi ➔ Bấm <kbd>Alt + Q</kbd>.<br>
                2. <strong>Câu hỏi ảnh / đồ thị / công thức:</strong> Bấm <kbd>Alt + V</kbd> (hoặc nút 📸 Chụp ảnh) ➔ AI Vision đọc ảnh và giải ngay.<br>
                3. Bấm nút <strong>"👆 Chỉ câu"</strong> (<kbd>Alt + S</kbd>) rồi nhấp vào vùng câu hỏi.
              </div>
              <div style="background: rgba(30, 41, 59, 0.7); padding: 7px 10px; border-radius: 6px; border-left: 3px solid #10b981;">
                <strong style="color: #34d399;">⚡ Tự Động Ấn Đáp Án:</strong><br>
                Bật nút <strong>"⚡ Tự ấn"</strong>, AI suy luận xong sẽ tự click trực tiếp vào đáp án đúng (A/B/C/D) trên Quizizz/Wayground/Azota.
              </div>
              <div style="background: rgba(30, 41, 59, 0.7); padding: 7px 10px; border-radius: 6px; border-left: 3px solid #f59e0b;">
                <strong style="color: #fbbf24;">🛡️ Phím Tắt & Tàng Hình:</strong><br>
                - Bấm <kbd>Esc</kbd> hoặc <kbd>Alt + H</kbd> để <strong>đóng / ẩn nhanh ngay lập tức</strong>.<br>
                - Bấm <kbd>Alt + Q</kbd> để mở lại và giải tiếp.
              </div>
              <div style="text-align: right; color: #94a3b8; font-size: 10.5px;">
                Phát triển bởi <strong>Lâm Dev</strong>
              </div>
            </div>
          </div>
          <div class="window-body">
            <div class="tools-collapsible" id="toolsCollapsible">
              <div class="model-bar">
                <select class="hud-select hud-select-provider" id="hudProviderSelect" title="Đổi hãng AI">
                  <option value="claude">👑 Claude</option>
                  <option value="groq">⚡ Groq</option>
                  <option value="gemini">✨ Gemini</option>
                  <option value="deepseek">🐳 DeepSeek</option>
                  <option value="openrouter">🆓 OpenRouter</option>
                  <option value="chatgpt">🤖 ChatGPT</option>
                </select>
                <select class="hud-select hud-select-model" id="hudModelSelect" title="Đổi Model"></select>
                <button class="btn-key-toggle" id="btnToggleKeyBox" title="Nhập/Đổi API Key">🔑</button>
              </div>
              <div class="key-inline-box" id="keyInlineBox">
                <input type="password" class="key-inline-input" id="hudKeyInput" placeholder="Dán API Key mới vào đây...">
                <button class="btn-key-save" id="btnSaveHudKey">Lưu Key</button>
              </div>
              <div class="action-bar">
                <button class="action-btn active-scroll" id="btnAutoScroll" title="Tự động quét & tra câu hỏi khi lăn chuột">📜<span class="act-lbl"> Cuộn tra</span></button>
                <button class="action-btn" id="btnAutoClick" title="Tự động click/chọn đáp án đúng trên trang khi AI giải xong">⚡<span class="act-lbl"> Tự ấn</span></button>
                <button class="action-btn" id="btnSolveSelected" title="Giải phần văn bản vừa bôi đen (Alt + Q)">🎯<span class="act-lbl"> Bôi đen</span></button>
                <button class="action-btn" id="btnPickQuestion" title="CLICK vào câu hỏi bất kỳ trên trang để giải (Alt + S)">👆<span class="act-lbl"> Chỉ câu</span></button>
                <button class="action-btn" id="btnCaptureSolve" title="Chụp & giải câu hỏi dạng hình ảnh / đồ thị / công thức (Alt + V)">📸<span class="act-lbl"> Chụp ảnh</span></button>
                <button class="action-btn" id="btnAutoScan" title="Quét toàn bộ câu hỏi & giải hết thành bảng đáp án">🔍<span class="act-lbl"> Quét đề</span></button>
              </div>
              <div class="question-pills" id="questionPills"></div>
              <button class="btn-turbo-solve" id="btnSendPrompt">⚡ Phân Tích Ngay</button>
            </div>

            <!-- BẢNG ĐÁP ÁN TỰ ĐỘNG -->
            <div class="answer-sheet" id="answerSheet">
              <div class="answer-sheet-header">
                <div class="answer-sheet-title" id="answerSheetTitle">📝 ĐÁP ÁN TẤT CẢ CÂU</div>
                <div class="answer-sheet-actions">
                  <button class="btn-sheet-action" id="btnSheetCopyAll" title="Sao chép toàn bộ đáp án">📋 Copy hết</button>
                  <button class="btn-sheet-action" id="btnSheetClose">✕</button>
                </div>
              </div>
              <div class="answer-sheet-body" id="answerSheetBody"></div>
            </div>

            <!-- KHỐI CÂU HỎI TỰ FULL HẾT RA -->
            <div class="question-card" id="questionCard">
              <div class="question-card-header">
                <span class="q-card-title" id="qCardTitle">📝 CÂU HỎI <span class="q-card-badge-auto">TỰ FULL</span></span>
                <div class="q-card-tools">
                  <button class="btn-card-tool" id="btnQuickSolve" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; font-weight: 700; border: 1px solid #3b82f6; padding: 2px 7px; border-radius: 4px;" title="Giải ngay lập tức câu hỏi này (Alt + Q)">⚡ Giải ngay</button>
                  <button class="btn-card-tool" id="btnTogglePromptEdit" title="Sửa hoặc gõ tay">✏️ Sửa</button>
                </div>
              </div>
              <div class="question-full-text" id="questionFullText">Lăn chuột tới câu hỏi để tự tra, hoặc bôi đen câu hỏi bất kỳ...</div>
              <textarea class="prompt-box" id="promptInput" placeholder="Bôi đen câu hỏi hoặc gõ vào đây..."></textarea>
            </div>

            <!-- KHỐI KẾT QUẢ GIẢI -->
            <div class="result-container" id="resultContainer" style="display: none;">
              <div class="result-header">
                <div class="result-title" id="resultTitle">✨ KẾT QUẢ:</div>
                <div class="result-actions">
                  <button class="btn-copy-ans" id="btnRetryOtherModel" title="Thử giải lại bằng Model khác">🔄 Đổi Model</button>
                  <button class="btn-copy-ans" id="btnCopyAns">📋 Copy</button>
                </div>
              </div>
              <!-- ĐÁP ÁN NỔI BẬT A/B/C/D -->
              <div class="answer-badge-wrap" id="answerBadgeWrap">
                <div class="answer-letter" id="answerLetter">A</div>
                <div class="answer-badge-info">
                  <div class="answer-badge-label">✅ Đáp án đúng</div>
                  <div class="answer-badge-text" id="answerBadgeText">—</div>
                </div>
              </div>
              <div class="result-box" id="resultText"></div>
            </div>
            <div class="mini-status" id="miniStatus"></div>
          </div>
          <div class="status-footer">
            <span>Ẩn: <kbd>Alt+H</kbd> | Cuộn: <kbd>Alt+A</kbd> | Giải: <kbd>Alt+Q</kbd></span>
            <span id="statusNote">Sẵn sàng</span>
          </div>
        </div>
      `;

      shadowRoot.appendChild(wrapper);
      this.applyTheme();
      this.setupEvents(shadowRoot);
      this.syncHudModelSelectors();

      // Tự động nhận diện nền tảng thi để hiển thị huy hiệu (Azota vs Wayground)
      try {
        const siteBadge = shadowRoot.getElementById("siteBadge");
        if (siteBadge) {
          const host = window.location.hostname.toLowerCase();
          if (host.includes("azota")) {
            siteBadge.textContent = "🛡️ Azota Pro";
            siteBadge.style.background = "rgba(59, 130, 246, 0.25)";
            siteBadge.style.borderColor = "#3b82f6";
            siteBadge.style.color = "#60a5fa";
          } else if (host.includes("wayground") || host.includes("quizizz")) {
            siteBadge.textContent = "⚡ Wayground Pro";
            siteBadge.style.background = "rgba(245, 158, 11, 0.25)";
            siteBadge.style.borderColor = "#f59e0b";
            siteBadge.style.color = "#fbbf24";
          } else {
            siteBadge.textContent = "🌐 All-in-One";
          }
        }
      } catch (_) {}

      if (wasOldHudOpen) {
        this.toggleWidget(true);
      }
    },

    toggleWidget(forceOpen = false) {
      if (!shadowRoot || !widgetContainer || !widgetContainer.isConnected) {
        this.initUI();
      }
      this.ensureHudInsideFullscreen();
      if (!shadowRoot) return;
      const aiWindow = shadowRoot.getElementById("aiWindow");
      if (!aiWindow) return;

      if (widgetContainer) widgetContainer.style.visibility = "";

      if (forceOpen || !widgetVisible) {
        aiWindow.style.display = "";
        aiWindow.style.pointerEvents = "auto";
        aiWindow.classList.add("visible");
        widgetVisible = true;
        const questions = window.__wgScanner ? window.__wgScanner.scanAllQuestionsOnPage(widgetContainer) : [];
        if (questions.length > 0) {
          scannedQuestionsList = questions;
          this.renderQuestionPills(questions);
        }
      } else {
        this.closeWidget();
      }
    },

    closeWidget() {
      if (!shadowRoot) return;
      const aiWindow = shadowRoot.getElementById("aiWindow");
      if (aiWindow) {
        aiWindow.style.display = "";
        aiWindow.style.pointerEvents = "auto";
        aiWindow.classList.remove("visible");
      }
      widgetVisible = false;
    },

    renderQuestionPills(questions) {
      if (!shadowRoot) return;
      const pillsContainer = shadowRoot.getElementById("questionPills");
      if (!pillsContainer) return;
      pillsContainer.innerHTML = "";

      if (!questions || questions.length === 0) {
        pillsContainer.classList.remove("visible");
        return;
      }
      pillsContainer.classList.add("visible");

      const lbl = document.createElement("span");
      lbl.className = "pills-label";
      lbl.textContent = "Chọn nhanh:";
      pillsContainer.appendChild(lbl);

      questions.forEach((qObj, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "q-pill";
        btn.textContent = qObj.label || `Câu ${idx + 1}`;
        btn.title = qObj.text.substring(0, 140);
        btn.addEventListener("click", () => this.selectScannedQuestion(idx));
        pillsContainer.appendChild(btn);
      });
    },

    formatQuestionForDisplay(text) {
      if (!text) return "";
      let clean = String(text).trim();
      // Chuẩn hóa xuống dòng trước các phương án A., B., C., D., E.
      clean = clean.replace(/([^\n])\s+([A-F][\.\)\:\-]\s+)/g, "$1\n$2");
      return clean;
    },

    updateQuestionDisplay(text, label = "Câu hỏi") {
      if (!shadowRoot) return;
      const questionFullText = shadowRoot.getElementById("questionFullText");
      const promptInput = shadowRoot.getElementById("promptInput");
      const qCardTitle = shadowRoot.getElementById("qCardTitle");

      const formatted = this.formatQuestionForDisplay(text);

      if (questionFullText) {
        questionFullText.textContent = formatted || text || "Chưa có nội dung câu hỏi...";
      }
      if (promptInput && document.activeElement !== promptInput) {
        promptInput.value = text || "";
      }
      if (qCardTitle && label) {
        qCardTitle.innerHTML = `📝 CÂU HỎI <span class="q-card-badge-auto">${label}</span>`;
      }
    },

    selectScannedQuestion(idx) {
      if (!scannedQuestionsList[idx] || !shadowRoot) return;
      const pillsContainer = shadowRoot.getElementById("questionPills");
      const pills = pillsContainer.querySelectorAll(".q-pill");
      pills.forEach((p, i) => p.classList.toggle("active", i === idx));

      const qObj = scannedQuestionsList[idx];
      activeQuestionTargetElement = qObj.element || null;
      this.updateQuestionDisplay(qObj.text, qObj.label || `Câu ${idx + 1}`);
      this.solvePrompt(qObj.text, qObj.label, qObj.element);
    },

    solveAllQuestions(questions) {
      if (!shadowRoot || !questions || questions.length === 0) return;
      const sheet = shadowRoot.getElementById("answerSheet");
      const sheetBody = shadowRoot.getElementById("answerSheetBody");
      const sheetTitle = shadowRoot.getElementById("answerSheetTitle");
      const statusNote = shadowRoot.getElementById("statusNote");
      if (!sheet || !sheetBody) return;

      sheetBody.innerHTML = "";
      sheet.classList.add("visible");
      const resultContainer = shadowRoot.getElementById("resultContainer");
      if (resultContainer) resultContainer.style.display = "none";

      const rowMeta = questions.map((q, idx) => {
        const row = document.createElement("div");
        row.className = "answer-sheet-row";
        const numEl = document.createElement("div");
        numEl.className = "as-num";
        numEl.textContent = q.label || `Câu ${idx + 1}`;
        const badge = document.createElement("div");
        badge.className = "as-badge loading";
        badge.textContent = "…";
        const textEl = document.createElement("div");
        textEl.className = "as-text";
        textEl.textContent = q.text.substring(0, 55);
        textEl.title = q.text;
        row.appendChild(numEl);
        row.appendChild(badge);
        row.appendChild(textEl);
        row.addEventListener("click", () => this.selectScannedQuestion(idx));
        sheetBody.appendChild(row);
        return { row, badge, textEl };
      });

      if (sheetTitle) sheetTitle.textContent = `⏳ ĐANG GIẢI ${questions.length} CÂU...`;
      let solved = 0;
      const total = questions.length;

      const solveNext = (idx) => {
        if (idx >= total) {
          if (sheetTitle) sheetTitle.textContent = `✅ ĐÁP ÁN ${total} CÂU`;
          if (statusNote) statusNote.textContent = `✅ Xong ${total} câu`;
          return;
        }
        const q = questions[idx];
        const { row, badge, textEl } = rowMeta[idx];
        const cleanQ = (q.text || "").trim();
        const allPills = shadowRoot.querySelectorAll(".q-pill");
        if (allPills[idx]) {
          allPills.forEach(p => p.classList.remove("active"));
          allPills[idx].classList.add("active");
          allPills[idx].scrollIntoView({ block: "nearest" });
        }
        row.style.background = "rgba(37,99,235,0.1)";

        const onResult = (letter, content) => {
          badge.className = `as-badge${letter ? ` letter-${letter}` : ""}`;
          badge.textContent = letter || "?";
          if (content) textEl.textContent = content;
          row.style.background = "";
          const p = shadowRoot.querySelectorAll(".q-pill");
          if (p[idx]) { p[idx].classList.remove("active"); p[idx].classList.add("solved"); }
          solved++;
          if (sheetTitle) sheetTitle.textContent = `⏳ ĐANG GIẢI... (${solved}/${total})`;
          if (statusNote) statusNote.textContent = `⏳ ${solved}/${total} câu`;
          setTimeout(() => solveNext(idx + 1), 320);
        };

        if (solvedQuestionsCache.has(cleanQ)) {
          const cached = solvedQuestionsCache.get(cleanQ);
          const letter = this.parseAnswerLetter(cached.answer);
          onResult(letter, letter ? this.extractAnswerContent(letter, cleanQ) : "");
          return;
        }
        if (!chrome.runtime || !chrome.runtime.id) { onResult(null, ""); return; }
        chrome.runtime.sendMessage({ action: "CALL_AI_API", questionText: cleanQ }, (res) => {
          if (!chrome.runtime.lastError && res && res.success) {
            const letter = this.parseAnswerLetter(res.data);
            solvedQuestionsCache.set(cleanQ, { answer: res.data, provider: res.provider });
            onResult(letter, letter ? this.extractAnswerContent(letter, cleanQ) : res.data.split("\n")[0].substring(0, 55));
          } else {
            badge.className = "as-badge"; badge.textContent = "✕"; badge.style.background = "#7f1d1d";
            row.style.background = "";
            solved++;
            setTimeout(() => solveNext(idx + 1), 320);
          }
        });
      };

      solveNext(0);
    },

    solvePrompt(question, customLabel = null, targetElement = null) {
      if (!shadowRoot) return;
      const resultContainer = shadowRoot.getElementById("resultContainer");
      const resultText = shadowRoot.getElementById("resultText");
      const statusNote = shadowRoot.getElementById("statusNote");
      const hudProviderSelect = shadowRoot.getElementById("hudProviderSelect");

      const updateStatus = (text) => {
        if (statusNote) statusNote.textContent = text;
        const miniStatus = shadowRoot.getElementById("miniStatus");
        if (miniStatus) miniStatus.textContent = text;
      };

      currentSolveRequestId++;
      const thisRequestId = currentSolveRequestId;

      activeQuestionTargetElement = targetElement || null;

      const cleanQ = (question || "").trim();
      if (!cleanQ) return;

      if (isCurrentlySolving && customLabel === "Tự tra") {
        return; // Đang giải câu trước, không gửi dồn dập làm nghẽn mạng!
      }
      isCurrentlySolving = true;

      this.updateQuestionDisplay(cleanQ, customLabel || "Câu hỏi");

      // Kiểm tra bộ nhớ đệm (Cache) để trả kết quả tức thì
      if (solvedQuestionsCache.has(cleanQ)) {
        isCurrentlySolving = false;
        const cached = solvedQuestionsCache.get(cleanQ);
        resultContainer.style.display = "flex";
        resultText.textContent = cached.answer;
        updateStatus(`⚡ Cache (${cached.provider || "AI"})${customLabel ? " - " + customLabel : ""}`);
        this.setCornerSolving(false);
        this.showAnswerBadge(cached.answer, cleanQ, activeQuestionTargetElement);
        return;
      }
      // Ẩn badge cũ khi bắt đầu giải mới
      this.hideAnswerBadge();
      this.setCornerSolving(true);

      resultContainer.style.display = "flex";
      resultText.innerHTML = `
        <div class="loading-spinner">
          <div class="spinner"></div>
          <span>Đang giải bằng ${hudProviderSelect ? hudProviderSelect.value.toUpperCase() : "AI"}...</span>
        </div>
      `;
      const startTime = performance.now();
      updateStatus(customLabel ? `Đang giải ${customLabel}...` : "Đang xử lý...");

      if (!chrome.runtime || !chrome.runtime.id) {
        isCurrentlySolving = false;
        this.setCornerSolving(false);
        resultText.textContent = "⚠️ Tiện ích vừa được tải lại! Hãy bấm F5 làm mới trang.";
        updateStatus("Cần F5 trang");
        return;
      }

      chrome.runtime.sendMessage({ action: "CALL_AI_API", questionText: cleanQ }, (res) => {
        // Nếu đã có câu hỏi mới hơn được gửi đi thì bỏ qua kết quả câu cũ bị delay
        if (thisRequestId !== currentSolveRequestId) {
          return;
        }

        isCurrentlySolving = false;
        this.setCornerSolving(false);
        const duration = ((performance.now() - startTime) / 1000).toFixed(2);
        if (chrome.runtime.lastError) {
          resultText.textContent = "Lỗi kết nối: " + chrome.runtime.lastError.message;
          updateStatus("Lỗi kết nối Extension");
          this.resetCornerAnswer();
          return;
        }

        if (res && res.success) {
          resultText.textContent = res.data;
          updateStatus(`⚡ ${duration}s (${res.provider || ""})${customLabel ? " - " + customLabel : ""}`);
          // Lưu vào Cache
          solvedQuestionsCache.set(cleanQ, {
            answer: res.data,
            provider: res.provider,
            duration: duration
          });
          // Hiện đáp án nổi bật & tự động click đúng câu hỏi
          this.showAnswerBadge(res.data, cleanQ, activeQuestionTargetElement);
        } else {
          const errMsg = res ? res.error : "Không thể gọi API";
          resultText.innerHTML = `
            <div style="color: #f87171; font-weight: 700; margin-bottom: 6px; font-size: 12px;">❌ Lỗi: ${errMsg}</div>
            <div style="font-size: 11.5px; color: #94a3b8; line-height: 1.55;">
              👉 <strong>Cách xử lý:</strong><br>
              1. Bấm 🛠️ để mở thanh công cụ → Thử đổi sang <strong>Groq</strong>, <strong>OpenRouter</strong> hoặc <strong>DeepSeek</strong>.<br>
              2. Bấm nút 🔑 để kiểm tra hoặc nhập lại API Key.<br>
              3. Mở popup extension để kiểm tra kết nối API.
            </div>
          `;
          updateStatus("Lỗi - Hãy đổi Model");
          this.hideAnswerBadge();
          this.resetCornerAnswer();
        }
      });
    },

    parseAnswerLetter(text) {
      if (!text || typeof text !== "string") return null;
      const clean = text.trim();

      // 1. Thử bắt dạng "👉 ĐÁP ÁN: A" hoặc "ĐÁP ÁN: [A/B/C/D/E]" hoặc "Đáp án: A"
      const m1 = clean.match(/(?:đáp\s*án|chọn|câu\s*trả\s*lời|answer|key|phương\s*án)\s*[:：\-–]?\s*[\*\[\(]?\s*([A-F])\b/i);
      if (m1) return m1[1].toUpperCase();

      // 2. Thử bắt ở đầu dòng: "A.", "A -", "**A**", "A)"
      const m2 = clean.match(/(?:^|\n)\s*[\*#\-–]*\s*([A-F])\s*[\.\:\)\-–\*\s]/i);
      if (m2) return m2[1].toUpperCase();

      // 3. Bắt ở dòng đầu tiên
      const firstLine = clean.split("\n")[0];
      const m3 = firstLine.match(/\b([A-F])\b/i);
      if (m3) return m3[1].toUpperCase();

      // 4. Tìm bất kỳ chữ cái A-F nào độc lập
      const m4 = clean.match(/(?:^|\s|\()([A-F])(?:\.|\)|\:|\s|$)/i);
      if (m4) return m4[1].toUpperCase();

      // 5. Dự phòng cuối cùng
      const m5 = clean.match(/([A-F])/i);
      return m5 ? m5[1].toUpperCase() : null;
    },

    extractAnswerContent(letter, questionText) {
      if (!letter || !questionText) return "";
      try {
        const regex = new RegExp(`(?:^|\\n)\\s*${letter}(?:[\\.\\)\\:\\-\\s]|\\n)\\s*([^\\n]+)`, "i");
        const match = questionText.match(regex);
        if (match && match[1]) {
          return match[1].trim();
        }
      } catch (_) {}
      return "";
    },

    syncHudModelSelectors() {
      if (!shadowRoot) return;
      const hudProviderSelect = shadowRoot.getElementById("hudProviderSelect");
      const hudModelSelect = shadowRoot.getElementById("hudModelSelect");
      const hudKeyInput = shadowRoot.getElementById("hudKeyInput");
      if (!hudProviderSelect || !hudModelSelect) return;

      chrome.storage.local.get(
        ["aiProvider", "geminiModel", "deepseekModel", "openaiModel", "groqModel", "openrouterModel",
         "geminiApiKey", "deepseekApiKey", "openaiApiKey", "groqApiKey", "openrouterApiKey"],
        (res) => {
          if (chrome.runtime.lastError) return;
          const provider = res.aiProvider || "gemini";
          hudProviderSelect.value = PROVIDER_MODELS[provider] ? provider : "gemini";
          this.populateHudModelOptions(hudProviderSelect.value, res);

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
    },

    populateHudModelOptions(provider, storageRes = {}) {
      if (!shadowRoot) return;
      const hudModelSelect = shadowRoot.getElementById("hudModelSelect");
      if (!hudModelSelect) return;

      const models = PROVIDER_MODELS[provider] || PROVIDER_MODELS.gemini;
      hudModelSelect.innerHTML = "";

      const currentModelMap = {
        claude: storageRes.claudeModel || "claude-3-7-sonnet-latest",
        gemini: storageRes.geminiModel || "gemini-3.5-flash-lite",
        deepseek: storageRes.deepseekModel || "deepseek-chat",
        chatgpt: storageRes.openaiModel || "o1",
        groq: storageRes.groqModel || "llama-3.3-70b-versatile",
        openrouter: storageRes.openrouterModel || "anthropic/claude-3.7-sonnet"
      };
      const savedModel = currentModelMap[provider];

      models.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m.value;
        opt.textContent = m.label;
        if (m.value === savedModel) opt.selected = true;
        hudModelSelect.appendChild(opt);
      });

      // Giữ lại model tùy chọn đã lưu từ popup nếu không có sẵn trong danh sách
      if (savedModel && !models.some((m) => m.value === savedModel)) {
        const opt = document.createElement("option");
        opt.value = savedModel;
        opt.textContent = `⭐ ${savedModel.split("/").pop()}`;
        opt.selected = true;
        hudModelSelect.prepend(opt);
      }
    },

    setupEvents(root) {
      const orb = root.getElementById("orbBtn");
      const aiWindow = root.getElementById("aiWindow");
      const dragHeader = root.getElementById("dragHeader");
      const minimizeBtn = root.getElementById("minimizeBtn");
      const btnToggleMini = root.getElementById("btnToggleMini");
      const btnToggleOpacity = root.getElementById("btnToggleOpacity");
      const hudProviderSelect = root.getElementById("hudProviderSelect");
      const hudModelSelect = root.getElementById("hudModelSelect");
      const btnToggleKeyBox = root.getElementById("btnToggleKeyBox");
      const keyInlineBox = root.getElementById("keyInlineBox");
      const hudKeyInput = root.getElementById("hudKeyInput");
      const btnSaveHudKey = root.getElementById("btnSaveHudKey");
      const btnAutoScroll = root.getElementById("btnAutoScroll");
      const btnAutoClick = root.getElementById("btnAutoClick");
      const btnSolveSelected = root.getElementById("btnSolveSelected");
      const btnPickQuestion = root.getElementById("btnPickQuestion");
      const btnAutoScan = root.getElementById("btnAutoScan");
      const btnCaptureSolve = root.getElementById("btnCaptureSolve");
      const promptInput = root.getElementById("promptInput");
      const btnSendPrompt = root.getElementById("btnSendPrompt");
      const resultText = root.getElementById("resultText");
      const statusNote = root.getElementById("statusNote");
      const btnCopyAns = root.getElementById("btnCopyAns");
      const btnRetryOtherModel = root.getElementById("btnRetryOtherModel");
      const btnCancelPick = root.getElementById("btnCancelPick");

      const btnToggleTools = root.getElementById("btnToggleTools");
      const btnTogglePromptEdit = root.getElementById("btnTogglePromptEdit");
      const questionFullText = root.getElementById("questionFullText");

      const btnToggleHelp = root.getElementById("btnToggleHelp");
      const btnCloseHelp = root.getElementById("btnCloseHelp");
      const hudHelpModal = root.getElementById("hudHelpModal");

      if (btnToggleHelp && hudHelpModal) {
        btnToggleHelp.addEventListener("click", () => {
          const isOpen = hudHelpModal.style.display !== "none";
          hudHelpModal.style.display = isOpen ? "none" : "block";
        });
      }
      if (btnCloseHelp && hudHelpModal) {
        btnCloseHelp.addEventListener("click", () => {
          hudHelpModal.style.display = "none";
        });
      }

      if (btnToggleTools) {
        btnToggleTools.addEventListener("click", () => {
          aiWindow.classList.toggle("compact-tools");
          const isCompact = aiWindow.classList.contains("compact-tools");
          btnToggleTools.classList.toggle("active-tool", !isCompact);
          chrome.storage.local.set({ hudCompactTools: isCompact });
        });
      }
      // compact-tools đã bật mặc định, không cần restore từ storage

      if (btnTogglePromptEdit && promptInput && questionFullText) {
        btnTogglePromptEdit.addEventListener("click", () => {
          const isEditing = promptInput.style.display === "block";
          if (isEditing) {
            promptInput.style.display = "none";
            questionFullText.style.display = "block";
            const txt = promptInput.value.trim();
            questionFullText.textContent = this.formatQuestionForDisplay(txt) || "Chưa có nội dung câu hỏi...";
            btnTogglePromptEdit.textContent = "✏️ Sửa";
          } else {
            promptInput.value = questionFullText.textContent;
            promptInput.style.display = "block";
            questionFullText.style.display = "none";
            promptInput.focus();
            btnTogglePromptEdit.textContent = "💾 Xong";
          }
        });
        promptInput.addEventListener("input", () => {
          questionFullText.textContent = this.formatQuestionForDisplay(promptInput.value);
        });
      }

      if (btnAutoScroll) {
        btnAutoScroll.addEventListener("click", () => this.toggleAutoScrollSolve());
      }

      if (btnAutoClick) {
        btnAutoClick.addEventListener("click", () => this.toggleAutoClick());
      }

      const btnQuickSolve = root.getElementById("btnQuickSolve");
      if (btnQuickSolve) {
        btnQuickSolve.addEventListener("click", () => {
          let text = (promptInput && promptInput.style.display === "block" ? promptInput.value : "") ||
                     (questionFullText ? questionFullText.textContent : "") ||
                     (promptInput ? promptInput.value : "");
          text = (text || "").trim();

          const isPlaceholder = !text || text.includes("Lăn chuột tới câu hỏi để tự tra");
          const isFragmentOnly = text.length < 50 && /^[A-F][\.\)\:\-]/i.test(text) && !text.includes("?");

          if (!isPlaceholder && !isFragmentOnly) {
            this.solvePrompt(text);
          } else if (window.__wgScanner) {
            const q = window.__wgScanner.findActiveQuestionInViewport(widgetContainer);
            if (q && q.text) {
              this.updateQuestionDisplay(q.text, q.label || "Câu hỏi");
              this.solvePrompt(q.text, q.label, q.element);
            } else {
              const allQ = window.__wgScanner.scanAllQuestionsOnPage(widgetContainer);
              if (allQ && allQ.length > 0) {
                this.updateQuestionDisplay(allQ[0].text, allQ[0].label || "Câu hỏi");
                this.solvePrompt(allQ[0].text, allQ[0].label, allQ[0].element);
              } else if (text && !isPlaceholder) {
                this.solvePrompt(text);
              }
            }
          }
        });
      }

      chrome.storage.local.get(["autoScrollSolveEnabled", "autoClickEnabled"], (res) => {
        if (!chrome.runtime.lastError) {
          if (res.autoScrollSolveEnabled !== undefined) {
            this.toggleAutoScrollSolve(res.autoScrollSolveEnabled, false);
          } else {
            this.toggleAutoScrollSolve(true, false);
          }
          if (res.autoClickEnabled !== undefined) {
            this.toggleAutoClick(res.autoClickEnabled, false);
          }
        }
      });

      // Quản lý độ mờ tùy chỉnh của icon orb và tooltip qua nút mắt và presets
      // Rê chuột vào orb -> Hiện mờ mờ theo nấc hover đã chọn, rời ra thì về mức idle tàng hình
      orb.addEventListener("mouseenter", () => {
        const p = OPACITY_PRESETS[currentPresetIndex] || OPACITY_PRESETS[1];
        orb.style.opacity = String(p.hover);
      });
      orb.addEventListener("mouseleave", () => {
        const p = OPACITY_PRESETS[currentPresetIndex] || OPACITY_PRESETS[1];
        orb.style.opacity = String(p.idle);
      });

      // Chuột phải vào orb -> Đổi độ mờ qua nút mắt
      orb.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.cycleOrbOpacity();
      });

      // Lăn chuột trên orb -> Đổi độ mờ giữa các nấc
      orb.addEventListener("wheel", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nextIdx = e.deltaY < 0 
          ? Math.min(OPACITY_PRESETS.length - 1, currentPresetIndex + 1)
          : Math.max(0, currentPresetIndex - 1);
        if (nextIdx !== currentPresetIndex) {
          this.applyOrbOpacityPreset(nextIdx, true, true);
        }
      }, { passive: false });

      this.bindOrbEyeButton();

        // Panic close inside shadowRoot: Bấm Ctrl hoặc Escape bên trong HUD cũng lập tức tắt ngay
        shadowRoot.addEventListener("keydown", (e) => {
          if (e.repeat) return;
          const isPanic =
            e.key === "Escape" || e.code === "Escape" ||
            e.key === "Control" || e.code === "ControlLeft" || e.code === "ControlRight";
          if (isPanic) {
            e.preventDefault();
            e.stopPropagation();
            this.stopPickQuestionMode();
            this.closeWidget();
          }
        }, true);

      try {
        chrome.storage.local.get(["orbOpacityPresetIdx", "stealthMode"], (res) => {
          if (!chrome.runtime.lastError && typeof res.orbOpacityPresetIdx === "number") {
            this.applyOrbOpacityPreset(res.orbOpacityPresetIdx, false, false);
          } else {
            this.applyOrbOpacityPreset(0, false, false);
          }
          if (res && res.stealthMode !== undefined) {
            this.applyStealthOrbVisibility(res.stealthMode);
          }
        });
      } catch (_) {
        this.applyOrbOpacityPreset(0, false, false);
      }

      orb.addEventListener("click", () => {
        if (orb.getAttribute("data-dragged") === "true") return;
        this.toggleWidget();
      });
      minimizeBtn.addEventListener("click", () => this.closeWidget());
      if (btnCancelPick) btnCancelPick.addEventListener("click", () => this.stopPickQuestionMode());

      btnToggleOpacity.addEventListener("click", () => {
        currentOpacityIndex = (currentOpacityIndex + 1) % opacityLevels.length;
        const op = opacityLevels[currentOpacityIndex];
        aiWindow.style.opacity = op;
        this.cycleOrbOpacity();
        btnToggleOpacity.title = op === 1.0 ? "Rõ" : op === 0.45 ? "Mờ" : "Ẩn";
      });

      const applyMiniMode = (mini) => {
        isMiniMode = mini;
        aiWindow.classList.toggle("mini-mode", isMiniMode);
        aiWindow.classList.toggle("full-mode", !isMiniMode);
        btnToggleMini.title = isMiniMode ? "Mở rộng khung" : "Thu nhỏ khung";
        btnToggleMini.classList.toggle("active-tool", !isMiniMode);
      };
      applyMiniMode(true);
      chrome.storage.local.get(["hudMiniMode"], (res) => {
        if (!chrome.runtime.lastError && res.hudMiniMode === false) applyMiniMode(false);
      });

      btnToggleMini.addEventListener("click", () => {
        applyMiniMode(!isMiniMode);
        chrome.storage.local.set({ hudMiniMode: isMiniMode });
      });

      // Khung nhỏ ẩn footer -> hiện trạng thái rút gọn ngay dưới kết quả
      const miniStatus = root.getElementById("miniStatus");
      if (miniStatus && statusNote) {
        new MutationObserver(() => {
          miniStatus.textContent = statusNote.textContent;
        }).observe(statusNote, { childList: true, characterData: true, subtree: true });
      }

      hudProviderSelect.addEventListener("change", () => {
        const newProvider = hudProviderSelect.value;
        const modelKeyMap = { claude: "claudeModel", gemini: "geminiModel", deepseek: "deepseekModel", chatgpt: "openaiModel", groq: "groqModel", openrouter: "openrouterModel" };
        const apiKeyMap = { claude: "claudeApiKey", gemini: "geminiApiKey", deepseek: "deepseekApiKey", chatgpt: "openaiApiKey", groq: "groqApiKey", openrouter: "openrouterApiKey" };
        chrome.storage.local.get(null, (res) => {
          res = res || {};
          this.populateHudModelOptions(newProvider, res);
          if (hudKeyInput) hudKeyInput.value = res[apiKeyMap[newProvider]] || "";
          chrome.storage.local.set({ aiProvider: newProvider, [modelKeyMap[newProvider]]: hudModelSelect.value });
          statusNote.textContent = res[apiKeyMap[newProvider]]
            ? `Đã đổi sang ${newProvider}`
            : `${newProvider}: chưa có key 🔑`;
        });
      });

      hudModelSelect.addEventListener("change", () => {
        const provider = hudProviderSelect.value;
        const model = hudModelSelect.value;
        const keyMap = { claude: "claudeModel", gemini: "geminiModel", deepseek: "deepseekModel", chatgpt: "openaiModel", groq: "groqModel", openrouter: "openrouterModel" };
        chrome.storage.local.set({ aiProvider: provider, [keyMap[provider]]: model }, () => {
          statusNote.textContent = `Đã chọn: ${model.split("/").pop()}`;
        });
      });

      btnToggleKeyBox.addEventListener("click", () => {
        keyInlineBox.classList.toggle("visible");
        if (keyInlineBox.classList.contains("visible")) hudKeyInput.focus();
      });

      btnSaveHudKey.addEventListener("click", () => {
        const val = hudKeyInput.value.trim();
        if (!val) return;
        let provider = hudProviderSelect.value;
        if (val.startsWith("sk-ant-")) provider = "claude";
        else if (val.startsWith("AIza")) provider = "gemini";
        else if (val.startsWith("gsk_")) provider = "groq";
        else if (val.startsWith("sk-or-")) provider = "openrouter";
        else if (/^sk-[0-9a-f]{32}$/i.test(val)) provider = "deepseek";
        else if (val.startsWith("sk-proj-")) provider = "chatgpt";

        const fieldMap = { claude: "claudeApiKey", gemini: "geminiApiKey", deepseek: "deepseekApiKey", chatgpt: "openaiApiKey", groq: "groqApiKey", openrouter: "openrouterApiKey" };
        chrome.storage.local.set({ aiProvider: provider, [fieldMap[provider]]: val }, () => {
          keyInlineBox.classList.remove("visible");
          this.syncHudModelSelectors();
          statusNote.textContent = `✅ Đã lưu Key (${provider})`;
        });
      });

      btnSolveSelected.addEventListener("mousedown", (e) => e.preventDefault());
      btnSolveSelected.addEventListener("click", () => {
        const sel = window.getSelection().toString().trim();
        const fallbackText = (questionFullText ? questionFullText.textContent : "") || promptInput.value.trim();
        const text = sel || fallbackText;
        if (text && !text.startsWith("Lăn chuột tới câu hỏi")) {
          this.updateQuestionDisplay(text, sel ? "Bôi đen" : "Câu hỏi");
          this.solvePrompt(text);
        }
      });

      btnPickQuestion.addEventListener("click", () => {
        if (isPickQuestionMode) this.stopPickQuestionMode();
        else this.startPickQuestionMode();
      });

      btnAutoScan.addEventListener("click", () => {
        const questions = window.__wgScanner ? window.__wgScanner.scanAllQuestionsOnPage(widgetContainer) : [];
        scannedQuestionsList = questions;
        if (questions.length > 0) {
          this.renderQuestionPills(questions);
          // Tự động giải hết và hiện bảng đáp án
          this.solveAllQuestions(questions);
        } else {
          statusNote.textContent = "Không thấy chữ! Hãy bấm '📸 Chụp'";
        }
      });

      btnCaptureSolve.addEventListener("click", () => this.captureScreenAndSolve());

      btnSendPrompt.addEventListener("click", () => {
        const text = (promptInput.value || (questionFullText ? questionFullText.textContent : "")).trim();
        if (text && !text.startsWith("Lăn chuột tới câu hỏi")) {
          this.updateQuestionDisplay(text, "Câu hỏi");
          this.solvePrompt(text);
        }
      });

      btnCopyAns.addEventListener("click", () => {
        const text = resultText.textContent;
        if (text) {
          navigator.clipboard.writeText(text).then(() => {
            btnCopyAns.textContent = "✅ Đã copy";
            setTimeout(() => { btnCopyAns.textContent = "📋 Copy"; }, 1400);
          });
        }
      });

      btnRetryOtherModel.addEventListener("click", () => {
        if (hudModelSelect.options.length > 1) {
          hudModelSelect.selectedIndex = (hudModelSelect.selectedIndex + 1) % hudModelSelect.options.length;
          hudModelSelect.dispatchEvent(new Event("change"));
          const q = (promptInput.value || (questionFullText ? questionFullText.textContent : "")).trim();
          if (q && !q.startsWith("Lăn chuột tới câu hỏi")) {
            solvedQuestionsCache.delete(q);
            setTimeout(() => this.solvePrompt(q), 150);
          }
        }
      });

      // Setup answer sheet buttons
      const btnSheetClose = root.getElementById("btnSheetClose");
      const btnSheetCopyAll = root.getElementById("btnSheetCopyAll");
      if (btnSheetClose) {
        btnSheetClose.addEventListener("click", () => {
          const sheet = shadowRoot.getElementById("answerSheet");
          if (sheet) sheet.classList.remove("visible");
        });
      }
      if (btnSheetCopyAll) {
        btnSheetCopyAll.addEventListener("click", () => {
          const rows = shadowRoot.querySelectorAll(".answer-sheet-row");
          let text = "";
          rows.forEach(row => {
            const num = row.querySelector(".as-num");
            const badge = row.querySelector(".as-badge");
            const txt = row.querySelector(".as-text");
            if (num && badge) text += `${num.textContent.trim()}: ${badge.textContent.trim()} - ${(txt ? txt.textContent.trim() : "")}\n`;
          });
          if (text) navigator.clipboard.writeText(text).then(() => {
            btnSheetCopyAll.textContent = "✅ Đã copy";
            setTimeout(() => { btnSheetCopyAll.textContent = "📋 Copy hết"; }, 1500);
          });
        });
      }

      this.restoreOrbPosition(orb);
        this.makeDraggable(orb);
      this.makeDraggableWindow(aiWindow, dragHeader);
    },

    captureScreenAndSolve() {
      if (!shadowRoot || !widgetContainer || !widgetContainer.isConnected) {
        this.initUI();
      }
      this.ensureHudInsideFullscreen();
      if (!shadowRoot) return;
      const aiWindow = shadowRoot.getElementById("aiWindow");
      const orb = shadowRoot.getElementById("orbBtn");
      const promptInput = shadowRoot.getElementById("promptInput");
      const resultContainer = shadowRoot.getElementById("resultContainer");
      const resultText = shadowRoot.getElementById("resultText");
      const statusNote = shadowRoot.getElementById("statusNote");

      // 1. Quét tìm canvas bài thi thật (chỉ lấy nếu canvas nằm trong viewport và có kích thước thực tế)
      let canvasDataUrl = null;
      let canvasText = "";
      try {
        let bestCanvas = null;
        let minDist = Infinity;
        const centerY = window.innerHeight / 2;
        const canvases = document.querySelectorAll("canvas");
        canvases.forEach((cv) => {
          const rect = cv.getBoundingClientRect();
          if (rect.width > 60 && rect.height > 50 && rect.bottom > 0 && rect.top < window.innerHeight) {
            const dist = Math.abs(rect.top + rect.height / 2 - centerY);
            if (dist < minDist) {
              minDist = dist;
              bestCanvas = cv;
            }
          }
        });
        if (bestCanvas) {
          canvasDataUrl = bestCanvas.toDataURL("image/jpeg", 0.85);
          canvasText = (bestCanvas.getAttribute("data-wg-canvas-text") || "").trim();
        }
      } catch (_) {}

      // 2. Tạm ẩn toàn bộ giao diện Extension để chụp ảnh bài thi sạch 100% (không bị che bởi HUD)
      if (widgetContainer) {
        widgetContainer.style.visibility = "hidden";
      }

      currentSolveRequestId++;
      const thisRequestId = currentSolveRequestId;

      // Đợi 70ms để trình duyệt render lại màn hình sạch
      setTimeout(() => {
        const startTime = performance.now();

        // Gửi lệnh chụp màn hình về background service worker
        chrome.runtime.sendMessage({ action: "CAPTURE_AND_SOLVE", canvasDataUrl, canvasText }, (res) => {
          if (thisRequestId !== currentSolveRequestId) return;
          const duration = ((performance.now() - startTime) / 1000).toFixed(2);

          // Khôi phục hiển thị HUD
          if (widgetContainer) widgetContainer.style.visibility = "";
          if (aiWindow) {
            aiWindow.style.display = "";
            aiWindow.style.pointerEvents = "auto";
            aiWindow.classList.add("visible");
          }
          widgetVisible = true;
          if (resultContainer) resultContainer.style.display = "flex";

          if (chrome.runtime.lastError) {
            if (resultText) resultText.textContent = "Lỗi kết nối background: " + chrome.runtime.lastError.message;
            if (statusNote) statusNote.textContent = "Lỗi";
            return;
          }

          if (res && res.success) {
            if (promptInput) {
              promptInput.value = canvasText || "[📸 Đã chụp màn hình trang thi & đọc đề bằng AI Vision]";
            }
            const questionFullText = shadowRoot.getElementById("questionFullText");
            if (questionFullText) {
              questionFullText.textContent = promptInput ? promptInput.value : "[📸 Đã chụp đề]";
            }
            if (resultText) resultText.textContent = res.data;
            if (statusNote) statusNote.textContent = `📸 ${duration}s (${res.provider || "Vision"})`;
            this.showAnswerBadge(res.data, canvasText || "");
          } else {
            if (resultText) resultText.textContent = "❌ " + (res ? res.error : "Không thể giải ảnh");
            if (statusNote) statusNote.textContent = "Lỗi Vision";
            this.hideAnswerBadge();
          }
        });

        // Hiện lại HUD sau 120ms (khi lệnh chụp captureVisibleTab đã chụp xong khung hình) để hiện thanh xoay loading
        setTimeout(() => {
          if (widgetContainer) widgetContainer.style.visibility = "";
          if (aiWindow) {
            aiWindow.style.display = "";
            aiWindow.style.pointerEvents = "auto";
            aiWindow.classList.add("visible");
            widgetVisible = true;
            if (resultContainer) resultContainer.style.display = "flex";
            if (resultText && !resultText.textContent.includes("📸")) {
              resultText.innerHTML = '<div class="loading-spinner"><div class="spinner"></div> Đang đọc hình ảnh & giải đề bằng AI Vision...</div>';
            }
            if (statusNote && !statusNote.textContent.includes("📸")) {
              statusNote.textContent = "Đang phân tích ảnh...";
            }
          }
        }, 120);
      }, 70);
    },

    startPickQuestionMode(initialX, initialY) {
      if (isPickQuestionMode) return;
      isPickQuestionMode = true;
      if (!shadowRoot || !widgetContainer || !widgetContainer.isConnected) {
        this.initUI();
      }
      this.ensureHudInsideFullscreen();
      if (!shadowRoot) return;
      if (widgetContainer) widgetContainer.style.visibility = "";
      this.applyTheme();

      const btnPick = shadowRoot.getElementById("btnPickQuestion");
      const pickBanner = shadowRoot.getElementById("pickBanner");
      const aiWindow = shadowRoot.getElementById("aiWindow");
      const statusNote = shadowRoot.getElementById("statusNote");

      if (btnPick) {
        btnPick.classList.add("active-pick");
        const actLbl = btnPick.querySelector(".act-lbl");
        if (actLbl) actLbl.textContent = " Đang chọn...";
      }
      if (pickBanner) pickBanner.classList.add("visible");
      if (statusNote) statusNote.textContent = "🎯 Click vào câu hỏi trên trang!";

      if (aiWindow) {
        aiWindow.style.opacity = "0.2";
        aiWindow.style.pointerEvents = "none";
      }
      try { document.body.style.cursor = "crosshair"; } catch (_) {}

      clearTimeout(pickModeTimer);
      window.removeEventListener("mousemove", this._onPickMouseMove, true);
      window.removeEventListener("mousedown", this._onPickMouseDown, true);
      window.removeEventListener("click", this._onPickClick, true);

      window.addEventListener("mousemove", this._onPickMouseMove, true);
      window.addEventListener("mousedown", this._onPickMouseDown, true);
      window.addEventListener("click", this._onPickClick, true);

      const posX = typeof initialX === "number" && initialX > 0 ? initialX : (window.__wgLastMouseX || 0);
      const posY = typeof initialY === "number" && initialY > 0 ? initialY : (window.__wgLastMouseY || 0);
      if (posX > 0 && posY > 0) {
        this._onPickMouseMove({ clientX: posX, clientY: posY });
      }
    },

    stopPickQuestionMode() {
      isPickQuestionMode = false;
      clearTimeout(pickModeTimer);
      window.removeEventListener("mousemove", this._onPickMouseMove, true);
      window.removeEventListener("mousedown", this._onPickMouseDown, true);
      window.removeEventListener("click", this._onPickClick, true);

      if (!shadowRoot) return;
      const btnPick = shadowRoot.getElementById("btnPickQuestion");
      const pickBanner = shadowRoot.getElementById("pickBanner");
      const pickOverlay = shadowRoot.getElementById("pickOverlay");
      const aiWindow = shadowRoot.getElementById("aiWindow");

      if (btnPick) {
        btnPick.classList.remove("active-pick");
        const actLbl = btnPick.querySelector(".act-lbl");
        if (actLbl) actLbl.textContent = " Chỉ câu";
      }
      if (pickBanner) pickBanner.classList.remove("visible");
      if (pickOverlay) pickOverlay.style.display = "none";
      try { document.body.style.cursor = ""; } catch (_) {}

      if (aiWindow) {
        aiWindow.style.opacity = String(opacityLevels[currentOpacityIndex] || 1.0);
        aiWindow.style.pointerEvents = "auto";
      }
    },

    _onPickMouseMove(e) {
      if (!isPickQuestionMode || !shadowRoot) return;
      const deepEl = window.__wgScanner ? window.__wgScanner.getDeepElementAtPoint(e.clientX, e.clientY, widgetContainer) : null;
      const pickOverlay = shadowRoot.getElementById("pickOverlay");
      if (!deepEl && pickOverlay) { pickOverlay.style.display = "none"; return; }

      const targetBox = window.__wgScanner ? window.__wgScanner.findBestQuestionContainer(deepEl) : null;
      if (targetBox && pickOverlay) {
        const rect = targetBox.getBoundingClientRect();
        pickOverlay.style.display = "block";
        pickOverlay.style.top = rect.top + "px";
        pickOverlay.style.left = rect.left + "px";
        pickOverlay.style.width = rect.width + "px";
        pickOverlay.style.height = rect.height + "px";
      }
    },

    _onPickMouseDown(e) {
      if (!isPickQuestionMode) return;
      if (widgetContainer && (e.target === widgetContainer || widgetContainer.contains(e.target))) return;
      e.preventDefault();
      e.stopPropagation();
    },

    _onPickClick(e) {
      if (!isPickQuestionMode) return;
      if (widgetContainer && (e.target === widgetContainer || widgetContainer.contains(e.target))) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const deepEl = (window.__wgScanner ? window.__wgScanner.getDeepElementAtPoint(e.clientX, e.clientY, widgetContainer) : null) || e.target;
      const targetBox = (window.__wgScanner ? window.__wgScanner.findBestQuestionContainer(deepEl) : null) || deepEl;
      const extracted = window.__wgScanner ? window.__wgScanner.extractQuestionFromElement(deepEl) : null;

      window.__wgHud.stopPickQuestionMode();
      window.__wgHud.toggleWidget(true);

      if (extracted && extracted.length >= 10) {
        const promptInput = shadowRoot.getElementById("promptInput");
        if (promptInput) promptInput.value = extracted;
        window.__wgHud.solvePrompt(extracted, "Chỉ câu", targetBox);
      } else {
        // Đề bài là ảnh hoặc canvas -> Tự động kích hoạt chụp màn hình giải bằng AI Vision
        const statusNote = shadowRoot.getElementById("statusNote");
        if (statusNote) statusNote.textContent = "📸 Đang chụp câu hỏi này...";
        window.__wgHud.captureScreenAndSolve();
      }
    },

    restoreOrbPosition(orb) {
      if (!orb) return;
      try {
        chrome.storage.local.get(["orbPosLeft", "orbPosTop"], (res) => {
          if (!chrome.runtime.lastError && res && typeof res.orbPosLeft === "number" && typeof res.orbPosTop === "number") {
            const maxLeft = Math.max(0, window.innerWidth - 45);
            const maxTop = Math.max(0, window.innerHeight - 45);
            const left = Math.min(Math.max(10, res.orbPosLeft), maxLeft);
            const top = Math.min(Math.max(10, res.orbPosTop), maxTop);
            orb.style.left = left + "px";
            orb.style.top = top + "px";
            orb.style.right = "auto";
            orb.style.bottom = "auto";
          }
        });
      } catch (_) {}
    },

    makeDraggable(element) {
      let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
      let hasDragged = false;

      const onMouseDown = (e) => {
        if (e.button !== 0) return; // Chỉ kéo bằng chuột trái
        startX = e.clientX;
        startY = e.clientY;
        const rect = element.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        hasDragged = false;

        const onMouseMove = (ev) => {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            hasDragged = true;
            element.classList.add("dragging");
          }
          if (hasDragged) {
            ev.preventDefault();
            const maxLeft = Math.max(0, window.innerWidth - element.offsetWidth - 10);
            const maxTop = Math.max(0, window.innerHeight - element.offsetHeight - 10);
            const newLeft = Math.min(Math.max(10, initialLeft + dx), maxLeft);
            const newTop = Math.min(Math.max(10, initialTop + dy), maxTop);
            element.style.left = newLeft + "px";
            element.style.top = newTop + "px";
            element.style.right = "auto";
            element.style.bottom = "auto";
          }
        };

        const onMouseUp = () => {
          window.removeEventListener("mousemove", onMouseMove, true);
          window.removeEventListener("mouseup", onMouseUp, true);
          document.removeEventListener("mousemove", onMouseMove, true);
          document.removeEventListener("mouseup", onMouseUp, true);
          element.classList.remove("dragging");

          if (hasDragged) {
            element.setAttribute("data-dragged", "true");
            setTimeout(() => element.removeAttribute("data-dragged"), 150);
            const rect = element.getBoundingClientRect();
            try {
              chrome.storage.local.set({
                orbPosLeft: Math.round(rect.left),
                orbPosTop: Math.round(rect.top)
              });
            } catch (_) {}
          }
        };

        window.addEventListener("mousemove", onMouseMove, true);
        window.addEventListener("mouseup", onMouseUp, true);
        document.addEventListener("mousemove", onMouseMove, true);
        document.addEventListener("mouseup", onMouseUp, true);
      };

      element.addEventListener("mousedown", onMouseDown);
    },

    makeDraggableWindow(winEl, headerEl) {
      let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
      headerEl.onmousedown = (e) => {
        if (e.target.closest("button") || e.target.closest("select")) return;
        e.preventDefault();
        startX = e.clientX; startY = e.clientY;
        const rect = winEl.getBoundingClientRect();
        initialLeft = rect.left; initialTop = rect.top;

        document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
        document.onmousemove = (ev) => {
          ev.preventDefault();
          winEl.style.top = Math.max(0, initialTop + (ev.clientY - startY)) + "px";
          winEl.style.left = Math.max(0, initialLeft + (ev.clientX - startX)) + "px";
          winEl.style.bottom = "auto"; winEl.style.right = "auto";
        };
      };
    },

    toggleAutoScrollSolve(forceState = null, saveToStorage = true) {
      if (forceState !== null) {
        autoScrollSolveEnabled = Boolean(forceState);
      } else {
        autoScrollSolveEnabled = !autoScrollSolveEnabled;
      }

      if (shadowRoot) {
        const btnAutoScroll = shadowRoot.getElementById("btnAutoScroll");
        const statusNote = shadowRoot.getElementById("statusNote");
        if (btnAutoScroll) {
          btnAutoScroll.classList.toggle("active-scroll", autoScrollSolveEnabled);
          btnAutoScroll.innerHTML = autoScrollSolveEnabled
            ? `📜<span class="act-lbl"> Cuộn: BẬT</span>`
            : `📜<span class="act-lbl"> Cuộn tra</span>`;
        }
        if (statusNote) {
          statusNote.textContent = autoScrollSolveEnabled
            ? "📜 Cuộn tự tra: ĐÃ BẬT"
            : "Đã tắt cuộn tự tra";
        }
      }

      if (saveToStorage) {
        chrome.storage.local.set({ autoScrollSolveEnabled });
      }

      // Nếu vừa bật, lập tức phát hiện câu hỏi đang ở tầm mắt
      if (autoScrollSolveEnabled) {
        this.handleAutoScrollDetect();
      }
    },

    toggleAutoClick(forceState = null, saveToStorage = true) {
      if (forceState !== null) {
        autoClickEnabled = Boolean(forceState);
      } else {
        autoClickEnabled = !autoClickEnabled;
      }

      if (shadowRoot) {
        const btnAutoClick = shadowRoot.getElementById("btnAutoClick");
        const statusNote = shadowRoot.getElementById("statusNote");
        if (btnAutoClick) {
          btnAutoClick.classList.toggle("active-click", autoClickEnabled);
          btnAutoClick.innerHTML = autoClickEnabled
            ? `⚡<span class="act-lbl"> Ấn: BẬT</span>`
            : `⚡<span class="act-lbl"> Tự ấn</span>`;
        }
        if (statusNote) {
          statusNote.textContent = autoClickEnabled
            ? "⚡ Tự ấn đáp án: ĐÃ BẬT"
            : "Đã tắt tự ấn";
        }
      }

      if (saveToStorage) {
        chrome.storage.local.set({ autoClickEnabled });
      }
    },

    highlightQuestionElement(el, label = "Tự động tra") {
      if (!shadowRoot || !el) return;
      const glow = shadowRoot.getElementById("autoScrollGlow");
      const badge = shadowRoot.getElementById("autoScrollBadge");
      if (!glow) return;

      const rect = el.getBoundingClientRect();
      glow.style.display = "block";
      glow.style.top = rect.top + "px";
      glow.style.left = rect.left + "px";
      glow.style.width = rect.width + "px";
      glow.style.height = rect.height + "px";
      glow.style.opacity = "1";

      if (badge) {
        badge.textContent = `📜 Đang tự tra ${label}...`;
      }

      if (glowTimeout) clearTimeout(glowTimeout);
      glowTimeout = setTimeout(() => {
        glow.style.opacity = "0";
        setTimeout(() => {
          glow.style.display = "none";
        }, 400);
      }, 1600);
    },

    handleAutoScrollDetect() {
      if (!autoScrollSolveEnabled || isPickQuestionMode) return;
      if (!window.__wgScanner) return;

      const q = window.__wgScanner.findActiveQuestionInViewport(widgetContainer);
      if (!q || !q.text) return;

      const cleanText = q.text.trim();
      if (cleanText.length < 15) return;

      // Nếu câu hỏi này trùng với câu vừa tự tra thì bỏ qua để không nháy lặp lại
      if (cleanText === lastAutoSolvedQuestionText) return;

      lastAutoSolvedQuestionText = cleanText;
      activeQuestionTargetElement = q.element || null;

      // Làm nổi bật câu hỏi đang được tự động tra trên màn hình để người dùng biết
      if (q.element) {
        this.highlightQuestionElement(q.element, q.label || "câu hỏi");
      }

      // Tự động bung full toàn bộ câu hỏi và các đáp án A/B/C/D ra vào bộ nhớ/giao diện
      this.updateQuestionDisplay(cleanText, q.label || "Tự tra");

      // Tự động giải trong nền & báo kết quả vào icon nhỏ ở góc màn hình
      this.solvePrompt(cleanText, q.label || "Tự tra", q.element);
    },

    updateCornerAnswerIcon(letter, content = "", fullAnswer = "") {
      if (!shadowRoot) return;
      const orb = shadowRoot.getElementById("orbBtn");
      const orbLetter = shadowRoot.getElementById("orbLetter");
      const orbTooltip = shadowRoot.getElementById("orbTooltip");
      if (!orb || !orbLetter) return;

      if (!letter) {
        this.resetCornerAnswer();
        return;
      }

      this.applyTheme();

      orb.classList.remove("solving");
      orb.classList.add("has-answer");

      orb.style.removeProperty("--ans-bg");
      orb.style.removeProperty("--ans-glow");
      orb.style.removeProperty("--ans-border");
      orb.style.background = "";
      orb.style.boxShadow = "";
      orb.style.borderColor = "";
      orbLetter.textContent = letter;

      // Nhịp đập nhẹ báo hiệu AI đã giải xong mà KHÔNG để lộ đáp án ra màn hình (Stealth)
      orb.style.animation = "none";
      void orb.offsetWidth;
      orb.style.animation = "orbReadyPulse 0.35s ease";
      setTimeout(() => {
        if (orb && orb.style.animation && orb.style.animation.includes("orbReadyPulse")) {
          orb.style.animation = "";
        }
      }, 360);

      if (orbTooltip) {
        let snippet = content || (fullAnswer ? fullAnswer.split("\n")[0] : "");
        if (snippet) {
          // Lọc bỏ tiền tố lặp thừa như "👉 ĐÁP ÁN: A -"
          snippet = snippet.replace(/^(?:👉\s*)?(?:đáp\s*án|answer|key|phương\s*án)?\s*[:：\-–]?\s*[A-F][\.\:\)\-–\s]*/i, "").trim();
          if (snippet.length > 42) {
            snippet = snippet.substring(0, 40) + "...";
          }
        }
        const curPreset = OPACITY_PRESETS[currentPresetIndex] || OPACITY_PRESETS[0];
        orbTooltip.innerHTML = `
          <div class="orb-tooltip-header">
            <div class="orb-tooltip-title">
              ✅ Đáp án: <span class="orb-tooltip-letter">${letter}</span>
            </div>
            <button class="orb-eye-btn" id="orbEyeBtn" title="Chỉnh độ mờ (Bấm để đổi: 5% ➔ 12% ➔ 25% ➔ 60%)">👁️ <span class="orb-eye-val" id="orbEyeVal">${Math.round(curPreset.hover * 100)}%</span></button>
          </div>
          ${snippet ? `<div class="orb-tooltip-snippet">${snippet}</div>` : ""}
          <div class="orb-tooltip-hint">Click: Xem | 👁️: ${curPreset.label} (Cuộn/Chuột phải)</div>
        `;
        this.bindOrbEyeButton();
      }
    },

    setCornerSolving(isSolving = true) {
      if (!shadowRoot) return;
      const orb = shadowRoot.getElementById("orbBtn");
      const orbLetter = shadowRoot.getElementById("orbLetter");
      const orbTooltip = shadowRoot.getElementById("orbTooltip");
      if (!orb) return;

      if (isSolving) {
        this.applyTheme();
        orb.classList.remove("has-answer");
        orb.classList.add("solving");
        orb.style.background = "";
        orb.style.boxShadow = "";
        orb.style.borderColor = "";
        orb.style.animation = "";
        orb.style.removeProperty("--ans-bg");
        orb.style.removeProperty("--ans-glow");
        orb.style.removeProperty("--ans-border");
        if (orbLetter) orbLetter.textContent = "";
        if (orbTooltip) {
          orbTooltip.innerHTML = `<span style="color:#fbbf24; font-weight:700; font-size: 11px;">⏳ Đang giải...</span>`;
        }
      } else {
        orb.classList.remove("solving");
      }
    },

    resetCornerAnswer() {
      if (!shadowRoot) return;
      const orb = shadowRoot.getElementById("orbBtn");
      const orbLetter = shadowRoot.getElementById("orbLetter");
      const orbTooltip = shadowRoot.getElementById("orbTooltip");
      if (!orb) return;

      this.applyTheme();
      orb.classList.remove("has-answer", "solving");
      orb.style.background = "";
      orb.style.boxShadow = "";
      orb.style.borderColor = "";
      orb.style.animation = "";
      orb.style.removeProperty("--ans-bg");
      orb.style.removeProperty("--ans-glow");
      orb.style.removeProperty("--ans-border");
      if (orbLetter) orbLetter.textContent = "";
      if (orbTooltip) {
        const curPreset = OPACITY_PRESETS[currentPresetIndex] || OPACITY_PRESETS[0];
        orbTooltip.innerHTML = `
          <div class="orb-tooltip-header">
            <div class="orb-tooltip-title">⚡ Way & Azota</div>
            <button class="orb-eye-btn" id="orbEyeBtn" title="Chỉnh độ mờ (Bấm để đổi: 5% ➔ 12% ➔ 25% ➔ 60%)">👁️ <span class="orb-eye-val" id="orbEyeVal">${Math.round(curPreset.hover * 100)}%</span></button>
          </div>
          <div class="orb-tooltip-hint">Click: Mở | 👁️: ${curPreset.label} (Cuộn/Chuột phải)</div>
        `;
        this.bindOrbEyeButton();
      }
    },

    showAnswerBadge(answerText, questionText, explicitTargetEl = null) {
      if (!shadowRoot) return;
      const letter = this.parseAnswerLetter(answerText);
      const content = this.extractAnswerContent(letter, questionText);

      // Cập nhật icon thật nhỏ báo đáp án ở dưới góc màn hình
      if (letter) {
        this.updateCornerAnswerIcon(letter, content, answerText);
      } else {
        this.resetCornerAnswer();
      }

      const wrap = shadowRoot.getElementById("answerBadgeWrap");
      const letterEl = shadowRoot.getElementById("answerLetter");
      const badgeTextEl = shadowRoot.getElementById("answerBadgeText");

      if (!letter) {
        if (wrap) wrap.classList.remove("visible");
        this.hideAnswerHighlightOnPage();
        return;
      }

      if (wrap && letterEl && badgeTextEl) {
        letterEl.style.background = "";
        letterEl.style.boxShadow = "";
        letterEl.textContent = letter;

        // Trích xuất nội dung phương án chuẩn
        let bestText = content;
        if (!bestText) {
          const firstLine = (answerText || "").split("\n")[0];
          bestText = firstLine.replace(/^(?:👉\s*)?(?:đáp\s*án|answer|key|phương\s*án)\s*[:：\-–]?\s*[A-F][\.\:\)\-–\s]*/i, "").trim();
        }
        badgeTextEl.textContent = bestText ? `${letter}. ${bestText}` : `Phương án ${letter}`;

        // Animate lại
        letterEl.style.animation = "none";
        void letterEl.offsetWidth;
        letterEl.style.animation = "answerPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both";

        wrap.classList.add("visible");
      }

      // Trình bày phần giải thích / căn cứ học thuật bên dưới
      const resultText = shadowRoot.getElementById("resultText");
      if (resultText && answerText) {
        const lines = answerText.split("\n").map((l) => l.trim()).filter(Boolean);
        const explanationLines = lines.filter((l) => !/^(?:👉\s*)?(?:đáp\s*án|answer|key)\s*[:：\-–]?\s*[A-F]\b/i.test(l));
        if (explanationLines.length > 0) {
          resultText.innerHTML = explanationLines
            .map((l) => {
              if (l.startsWith("💡") || l.startsWith("Căn cứ") || l.startsWith("Giải thích")) {
                return `<div style="color: #38bdf8; font-weight: 700; margin-bottom: 3px;">${l}</div>`;
              }
              return `<div style="color: #cbd5e1; margin-bottom: 2px;">${l}</div>`;
            })
            .join("");
          resultText.style.display = "block";
        } else {
          resultText.innerHTML = `<div style="color: #34d399; font-weight: 600;">✅ Đã thẩm định và chọn phương án ${letter} là chính xác nhất 10/10.</div>`;
          resultText.style.display = "block";
        }
      }

      // Tự động cuộn khung kết quả vào tầm mắt
      const resContainer = shadowRoot.getElementById("resultContainer");
      if (resContainer) {
        resContainer.style.display = "flex";
        try {
          resContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } catch (_) {}
      }

      // Tự động ấn vào đáp án đúng trên trang nếu tính năng Auto-Click đang BẬT
      if (autoClickEnabled) {
        this.clickAnswerOnPage(letter, questionText, explicitTargetEl);
      }
    },

    hideAnswerBadge() {
      if (!shadowRoot) return;
      const wrap = shadowRoot.getElementById("answerBadgeWrap");
      if (wrap) wrap.classList.remove("visible");
      this.hideAnswerHighlightOnPage();
      this.resetCornerAnswer();
    },

    clickAnswerOnPage(letter, questionText, explicitTargetEl = null) {
      try {
        if (!letter) return;
        let targetEl = null;

        // 1. Xác định chính xác container câu hỏi mục tiêu
        let qEl = explicitTargetEl || activeQuestionTargetElement || null;

        // Nếu câu hỏi có số thứ tự (ví dụ Question 1, Câu 1)
        const qNumMatch = (questionText || "").match(/(?:Question|Câu|Bài)\s*(\d+)/i);
        const targetQNum = qNumMatch ? qNumMatch[1] : null;

        // Nếu chưa có qEl hoặc qEl không khớp số câu, tìm đúng container chứa "Question X"
        if (targetQNum) {
          const allHeaders = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6, b, strong, div, span, p"));
          for (const h of allHeaders) {
            if (widgetContainer && widgetContainer.contains(h)) continue;
            const t = h.textContent.trim();
            if (new RegExp(`^(?:Question|Câu|Bài)\\s*${targetQNum}\\b`, "i").test(t)) {
              // Tìm container khối câu hỏi bao bọc thẻ này
              let parent = h.parentElement;
              while (parent && parent !== document.body && parent !== document.documentElement) {
                // Container chứa ít nhất 2 phương án hoặc radio
                const opts = parent.querySelectorAll("label, input[type='radio'], input[type='checkbox'], [class*='option'], [class*='answer']");
                if (opts.length >= 2 && parent.offsetWidth > 150) {
                  qEl = parent;
                  break;
                }
                parent = parent.parentElement;
              }
              if (qEl) break;
            }
          }
        }

        // Dự phòng: Tìm câu hỏi đang ở tầm mắt nếu vẫn chưa xác định được
        if (!qEl && window.__wgScanner) {
          const q = window.__wgScanner.findActiveQuestionInViewport(widgetContainer);
          if (q && q.element) qEl = q.element;
        }

        const letterRe = new RegExp(`^\\s*${letter}[.:\\)\\s]?$|^\\s*${letter}[.:\\)\\s]`, "i");

        // Cách 1: Tìm theo nhãn / nút tròn / text chữ cái A, B, C, D bên trong container câu hỏi
        if (qEl) {
          // Ưu tiên tìm các nút tròn lựa chọn của Azota (nút chứa A, B, C, D)
          const azotaButtons = qEl.querySelectorAll("button, label, [class*='circle'], [class*='btn'], [class*='option'], [class*='answer'], [class*='item']");
          for (const btn of azotaButtons) {
            const btnTxt = btn.textContent.trim();
            if (letterRe.test(btnTxt) || btnTxt === letter) {
              targetEl = btn;
              break;
            }
          }

          if (!targetEl) {
            const allEls = qEl.querySelectorAll("*");
            for (const el of allEls) {
              if (el.children.length === 0 && (letterRe.test(el.textContent.trim()) || el.textContent.trim() === letter)) {
                targetEl = el;
                break;
              }
            }
          }

          // So khớp theo nội dung đáp án (ví dụ từ "they")
          if (!targetEl && questionText) {
            const ansContent = this.extractAnswerContent(letter, questionText);
            if (ansContent && ansContent.length >= 3) {
              const snippet = ansContent.trim().toLowerCase();
              const allEls = qEl.querySelectorAll("*");
              for (const el of allEls) {
                if (el.children.length === 0 && el.textContent.trim().toLowerCase() === snippet) {
                  targetEl = el;
                  break;
                }
              }
            }
          }
        }

        // Cách 2: Nếu chưa tìm thấy trong container và KHÔNG phải Azota (tránh nhảy sang câu khác)
        if (!targetEl && !window.location.hostname.includes("azota")) {
          const candidates = Array.from(document.querySelectorAll("button, [role='button'], label, .option-item, .answer-option, [class*='option'], [class*='choice'], [class*='answer']"));
          for (const el of candidates) {
            if (widgetContainer && widgetContainer.contains(el)) continue;
            const text = el.textContent.trim();
            if (letterRe.test(text)) {
              targetEl = el;
              break;
            }
          }
        }

        if (targetEl) {
          // Tìm phần tử click tốt nhất: input radio/checkbox, label, button, hoặc thẻ cha bao bọc
          const clickable =
            targetEl.querySelector("input[type='radio'], input[type='checkbox'], button, [role='button']") ||
            targetEl.closest("label, button, [role='button'], .option-item, [class*='option'], [class*='choice'], [class*='card'], li, tr") ||
            targetEl;

          // MÔ PHỎNG CLICK NGƯỜI THẬT 100% (HUMAN SIMULATION - CHỐNG BẮT BOT TỰ ĐỘNG)
          const fireHumanLikeClick = (el) => {
            try {
              const rect = el.getBoundingClientRect();
              // Tạo tọa độ ngẫu nhiên rơi trúng bên trong nút giống người di chuột thật
              const x = rect.left + rect.width * (0.35 + Math.random() * 0.3);
              const y = rect.top + rect.height * (0.35 + Math.random() * 0.3);

              const mouseOpts = {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: Math.round(x),
                clientY: Math.round(y),
                screenX: Math.round(window.screenX + x),
                screenY: Math.round(window.screenY + y + 80),
                buttons: 1
              };

              // 1. Hover vào nút
              el.dispatchEvent(new MouseEvent("mousemove", mouseOpts));
              el.dispatchEvent(new MouseEvent("mouseenter", mouseOpts));
              el.dispatchEvent(new MouseEvent("mouseover", mouseOpts));

              // 2. Nhấn chuột xuống (mousedown)
              el.focus?.();
              el.dispatchEvent(new MouseEvent("mousedown", mouseOpts));

              // 3. Nhả chuột và click thật
              setTimeout(() => {
                try {
                  el.dispatchEvent(new MouseEvent("mouseup", mouseOpts));
                  el.dispatchEvent(new MouseEvent("click", mouseOpts));
                  // Kích hoạt method click chuẩn của DOM
                  el.click?.();
                  if (el.tagName === "INPUT") {
                    el.checked = true;
                    el.dispatchEvent(new Event("change", { bubbles: true }));
                  }
                } catch (_) {}
              }, 40 + Math.floor(Math.random() * 40));
            } catch (_) {
              el.click?.();
            }
          };

          // Delay ngẫu nhiên tự nhiên (180ms - 320ms) như phản xạ người bấm
          const humanDelay = 180 + Math.floor(Math.random() * 140);
          setTimeout(() => {
            fireHumanLikeClick(clickable);
            const statusNote = shadowRoot.getElementById("statusNote");
            if (statusNote) {
              statusNote.textContent = `⚡ Đã tự ấn: Đáp án ${letter} (Human)`;
            }
          }, humanDelay);
        }
      } catch (_) {}
    },

    highlightAnswerOnPage(letter, questionText, explicitTargetEl = null) {
      // Đã gỡ bỏ tính năng vẽ viền và nhãn đáp án trên trang để tránh bị lộ khi thi
      return;
    },

    hideAnswerHighlightOnPage() {
      if (!shadowRoot) return;
      const overlay = shadowRoot.getElementById("answerHighlightOverlay");
      if (overlay) { overlay.style.display = "none"; }
    }
  };
})();
