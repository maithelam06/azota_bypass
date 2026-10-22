// content/index.js
// Điểm khởi chạy (Entry Point) của Content Script - Kết nối các mô-đun và lắng nghe phím tắt

(function () {
  "use strict";

  const isTopFrame = window === window.top;
  let isEnabled = true;
  let lastHoveredElement = null;
  let lastSelectedText = "";
  let lastMouseX = 0;
  let lastMouseY = 0;

  // 1. Theo dõi phần tử chuột đang trỏ tới
  window.addEventListener(
    "mousemove",
    (e) => {
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      window.__wgLastMouseX = e.clientX;
      window.__wgLastMouseY = e.clientY;
      const hudContainer = window.__wgHud ? window.__wgHud.widgetContainer : null;
      const deepEl = (window.__wgScanner ? window.__wgScanner.getDeepElementAtPoint(e.clientX, e.clientY, hudContainer) : null) || e.target;
      if (deepEl && deepEl !== hudContainer) {
        lastHoveredElement = deepEl;
      }
    },
    { passive: true }
  );

  // 2. Tự động lưu văn bản bôi đen theo thời gian thực (để không bị mất khi bấm nút)
  function captureCurrentSelection() {
    try {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      if (text.length >= 10) {
        lastSelectedText = text;
        const shadow = window.__wgHud ? window.__wgHud.shadowRoot : null;
        if (shadow) {
          const isSingleOption = text.length < 60 && /^[A-F][\.\)\:\-]/i.test(text);
          // Chỉ tự động cập nhật khung câu hỏi nếu bôi đen đoạn dài đủ ý, không bị ghi đè bởi 1 đáp án nhấp chuột
          if (text.length >= 25 && !isSingleOption) {
            const promptInput = shadow.getElementById("promptInput");
            if (promptInput && document.activeElement !== promptInput) {
              promptInput.value = text;
            }
            if (window.__wgHud && window.__wgHud.updateQuestionDisplay) {
              window.__wgHud.updateQuestionDisplay(text, "Bôi đen");
            }
          }
          const statusNote = shadow.getElementById("statusNote");
          if (statusNote) {
            statusNote.textContent = "Đã nhận chữ bôi đen! Bấm 🎯 hoặc Alt+Q";
          }
        }
      } else if (!text || (sel && sel.isCollapsed)) {
        lastSelectedText = "";
      }
    } catch (_) {}
  }

  document.addEventListener("selectionchange", captureCurrentSelection, { passive: true });
  window.addEventListener("mouseup", () => setTimeout(captureCurrentSelection, 20), { passive: true });

  // 3. Theo dõi hành vi lăn chuột / cuộn trang để tự động quét & tra câu hỏi (Auto-Scroll Solver)
  let scrollTimeout = null;
  function onScrollOrWheel() {
    if (!window.__wgHud || !window.__wgHud.autoScrollSolveEnabled) return;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (window.__wgHud && window.__wgHud.autoScrollSolveEnabled) {
        window.__wgHud.handleAutoScrollDetect();
      }
    }, 320);
  }

  window.addEventListener("scroll", onScrollOrWheel, { passive: true, capture: true });
  window.addEventListener("wheel", onScrollOrWheel, { passive: true, capture: true });

  // 4. Khởi tạo toàn bộ mô-đun
  function startExtension() {
    if (!isEnabled) return;
    if (window.__wgBypass) {
      window.__wgBypass.initAntiCopyAndProctorBypass();
    }
    if (isTopFrame && window.__wgHud) {
      window.__wgHud.initUI();
      // Tự động phát hiện câu hỏi đầu tiên sau khi trang nạp xong
      setTimeout(() => {
        try {
          if (window.__wgHud && window.__wgHud.autoScrollSolveEnabled) {
            window.__wgHud.handleAutoScrollDetect();
          }
        } catch (_) {}
      }, 1000);
    }
  }

  try {
    chrome.storage.local.get(["extensionEnabled", "unblockCopyEnabled", "stealthMode", "autoScrollSolveEnabled", "autoClickEnabled"], (res) => {
      if (chrome.runtime.lastError) return;
      if (res.extensionEnabled !== undefined) isEnabled = res.extensionEnabled;
      if (res.unblockCopyEnabled !== undefined && window.__wgBypass) {
        window.__wgBypass.unblockCopyEnabled = res.unblockCopyEnabled;
      }
      if (res.stealthMode !== undefined && window.__wgBypass) {
        window.__wgBypass.stealthMode = res.stealthMode;
      }
      const autoScroll = res.autoScrollSolveEnabled !== undefined ? res.autoScrollSolveEnabled : true;
      if (window.__wgHud) {
        window.__wgHud.toggleAutoScrollSolve(autoScroll, false);
      }
      if (res.autoClickEnabled !== undefined && window.__wgHud) {
        window.__wgHud.toggleAutoClick(res.autoClickEnabled, false);
      }

      startExtension();
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startExtension, { once: true });
      }
      window.addEventListener("load", startExtension, { once: true });
    });

    // Lắng nghe thay đổi cài đặt từ Popup
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local") {
        if (changes.extensionEnabled) {
          isEnabled = changes.extensionEnabled.newValue;
          if (isEnabled) startExtension();
          else if (window.__wgHud) window.__wgHud.closeWidget();
        }
        if (changes.unblockCopyEnabled && window.__wgBypass) {
          window.__wgBypass.unblockCopyEnabled = changes.unblockCopyEnabled.newValue;
        }
        if (changes.autoScrollSolveEnabled && window.__wgHud) {
          window.__wgHud.toggleAutoScrollSolve(changes.autoScrollSolveEnabled.newValue, false);
        }
        if (changes.autoClickEnabled && window.__wgHud) {
          window.__wgHud.toggleAutoClick(changes.autoClickEnabled.newValue, false);
        }
        if (
          changes.aiProvider ||
          changes.geminiModel ||
          changes.deepseekModel ||
          changes.openaiModel ||
          changes.groqModel ||
          changes.openrouterModel
        ) {
          if (window.__wgHud) window.__wgHud.syncHudModelSelectors();
        }
      }
    });

    chrome.runtime.onMessage.addListener((msg) => {
      if (isTopFrame && msg) {
        if (msg.action === "WG_HOTKEY_ALT_Q") {
          triggerAltQ();
          return;
        }
        if (msg.action === "WG_HOTKEY_ALT_S") {
          triggerAltS();
          return;
        }
        if (msg.action === "WG_HOTKEY_ALT_V") {
          triggerAltV();
          return;
        }
        if (msg.action === "WG_HOTKEY_ALT_H") {
          triggerAltH();
          return;
        }
        if (msg.action === "PROCESS_SELECTION" && msg.text && window.__wgHud) {
          window.__wgHud.toggleWidget(true);
          if (window.__wgHud.updateQuestionDisplay) {
            window.__wgHud.updateQuestionDisplay(msg.text, "Bôi đen");
          }
          window.__wgHud.solvePrompt(msg.text);
          return;
        }
      }
    });
  } catch (_) {}

  let lastAltQTime = 0;
  let lastAltHTime = 0;
  let lastAltSTime = 0;
  let lastAltVTime = 0;

  function triggerAltQ() {
    const now = Date.now();
    // Chống mở lặp / spam 2 lần khi ấn Alt+Q (từ cả Chrome Command & keydown listener)
    if (now - lastAltQTime < 500) return;
    lastAltQTime = now;

    if (!window.__wgHud) return;
    if (!window.__wgHud.shadowRoot) {
      window.__wgHud.initUI();
    }
    window.__wgHud.ensureHudInsideFullscreen();

    let selected = window.getSelection().toString().trim();
    const isSingleOption = (str) => Boolean(str && str.length < 50 && /^[A-F][\.\)\:\-]/i.test(str));
    let targetEl = null;
    let targetLabel = "Câu hỏi";

    // 1. Nếu có phần tử dưới con trỏ chuột
    if ((!selected || isSingleOption(selected)) && lastHoveredElement && window.__wgScanner) {
      const hoveredQ = window.__wgScanner.extractQuestionFromElement(lastHoveredElement);
      if (hoveredQ && !isSingleOption(hoveredQ)) {
        selected = hoveredQ;
        targetEl = window.__wgScanner.findBestQuestionContainer(lastHoveredElement) || lastHoveredElement;
      }
    }

    // 2. Tìm câu hỏi đang hiển thị rõ nhất trong tầm nhìn (Viewport)
    if ((!selected || isSingleOption(selected)) && window.__wgScanner) {
      const qInView = window.__wgScanner.findActiveQuestionInViewport(window.__wgHud.widgetContainer);
      if (qInView && qInView.text) {
        selected = qInView.text;
        targetLabel = qInView.label || "Câu hỏi";
        targetEl = qInView.element || null;
      }
    }

    // 3. Quét danh sách tất cả câu hỏi trên trang & lấy câu gần trung tâm màn hình
    if ((!selected || isSingleOption(selected)) && window.__wgScanner) {
      const allQ = window.__wgScanner.scanAllQuestionsOnPage(window.__wgHud.widgetContainer);
      if (allQ.length > 0) {
        window.__wgHud.renderQuestionPills(allQ);
        const bestIdx = window.__wgScanner.findQuestionClosestToViewportCenter(allQ);
        selected = allQ[bestIdx]?.text || "";
        targetLabel = allQ[bestIdx]?.label || "Câu hỏi";
        targetEl = allQ[bestIdx]?.element || null;
      }
    }

    // 4. Dự phòng cuối cùng: text bôi đen gần đây nhất
    if ((!selected || isSingleOption(selected)) && lastSelectedText && !isSingleOption(lastSelectedText)) {
      selected = lastSelectedText;
    }

    window.__wgHud.toggleWidget(true);
    if (selected && selected.length >= 10) {
      if (window.__wgHud.updateQuestionDisplay) {
        window.__wgHud.updateQuestionDisplay(selected, targetLabel);
      }
      window.__wgHud.solvePrompt(selected, targetLabel, targetEl);
      lastSelectedText = ""; // Xóa bộ nhớ bôi đen cũ để không bị dính sang câu tiếp theo
    } else {
      // Nếu không tìm thấy văn bản (đề bài dạng ảnh hoặc canvas vẽ) -> Tự động chuyển chụp màn hình AI Vision
      window.__wgHud.captureScreenAndSolve();
    }
  }

  function triggerAltH() {
    const now = Date.now();
    if (now - lastAltHTime < 500) return;
    lastAltHTime = now;

    if (!window.__wgHud) return;
    if (!window.__wgHud.shadowRoot) {
      window.__wgHud.initUI();
    }
    window.__wgHud.ensureHudInsideFullscreen();

    if (window.__wgHud.isPickQuestionMode) {
      window.__wgHud.stopPickQuestionMode();
      window.__wgHud.closeWidget();
      return;
    }

    const shadow = window.__wgHud.shadowRoot;
    const aiWindow = shadow ? shadow.getElementById("aiWindow") : null;
    const isVisible = window.__wgHud.widgetVisible || (aiWindow && aiWindow.classList.contains("visible"));

    if (isVisible) {
      window.__wgHud.closeWidget();
    } else {
      window.__wgHud.toggleWidget(true);
    }
  }

  function triggerAltS() {
    const now = Date.now();
    if (now - lastAltSTime < 700) return;
    lastAltSTime = now;

    if (!window.__wgHud) return;
    if (!window.__wgHud.shadowRoot) {
      window.__wgHud.initUI();
    }
    window.__wgHud.ensureHudInsideFullscreen();

    if (window.__wgHud.isPickQuestionMode) {
      window.__wgHud.stopPickQuestionMode();
    } else {
      window.__wgHud.startPickQuestionMode(lastMouseX, lastMouseY);
    }
  }

  function triggerAltV() {
    const now = Date.now();
    if (now - lastAltVTime < 1000) return;
    lastAltVTime = now;

    if (!window.__wgHud) return;
    if (!window.__wgHud.shadowRoot) {
      window.__wgHud.initUI();
    }
    window.__wgHud.ensureHudInsideFullscreen();
    window.__wgHud.captureScreenAndSolve();
  }

  // Lắng nghe lệnh gọi từ iframe con
  if (isTopFrame) {
    window.addEventListener("message", (ev) => {
      if (ev.data) {
        if (ev.data.action === "WG_TRIGGER_ALT_Q") {
          triggerAltQ();
        } else if (ev.data.action === "WG_TRIGGER_ALT_S") {
          triggerAltS();
        } else if (ev.data.action === "WG_TRIGGER_ALT_H") {
          triggerAltH();
        } else if (ev.data.action === "WG_TRIGGER_ALT_V") {
          triggerAltV();
        }
      }
    });
  }

  // 5. PHÍM TẮT TOÀN CỤC (Alt + Q, Alt + S, Alt + V, Alt + H, Alt + X)
  window.addEventListener(
    "keydown",
    (e) => {
      // Bỏ qua khi người dùng giữ phím (key repeat) để tránh việc bật/tắt liên tục
      if (e.repeat) return;

      // Nếu sự kiện phím xảy ra trong iframe con, chuyển tiếp về khung chính (Top frame)
      if (!isTopFrame) {
        if (e.altKey && (e.key === "q" || e.key === "Q" || e.code === "KeyQ")) {
          e.preventDefault();
          e.stopImmediatePropagation();
          try {
            window.top.postMessage({ action: "WG_TRIGGER_ALT_Q" }, "*");
          } catch (_) {}
          return;
        }
        if (e.altKey && (e.key === "s" || e.key === "S" || e.code === "KeyS")) {
          e.preventDefault();
          e.stopImmediatePropagation();
          try {
            window.top.postMessage({ action: "WG_TRIGGER_ALT_S" }, "*");
          } catch (_) {}
          return;
        }
        if (e.altKey && (e.key === "h" || e.key === "H" || e.code === "KeyH" || e.key === "x" || e.key === "X" || e.code === "KeyX")) {
          e.preventDefault();
          e.stopImmediatePropagation();
          try {
            window.top.postMessage({ action: "WG_TRIGGER_ALT_H" }, "*");
          } catch (_) {}
          return;
        }
        if (e.altKey && (e.key === "v" || e.key === "V" || e.code === "KeyV")) {
          e.preventDefault();
          e.stopImmediatePropagation();
          try {
            window.top.postMessage({ action: "WG_TRIGGER_ALT_V" }, "*");
          } catch (_) {}
          return;
        }
        return;
      }

      if (!window.__wgHud) return;

      // Alt + H hoặc Alt + X: Ẩn/Hiện nhanh HUD
      if (e.altKey && (e.key === "h" || e.key === "H" || e.code === "KeyH" || e.key === "x" || e.key === "X" || e.code === "KeyX")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        triggerAltH();
        return;
      }

      // Phím Escape: Tắt nhanh bảng HUD hoặc Hủy chế độ Chỉ câu (Ngay lập tức)
      if (e.key === "Escape" || e.code === "Escape") {
        const isHudOpen =
          window.__wgHud &&
          (window.__wgHud.isPickQuestionMode ||
            window.__wgHud.widgetVisible ||
            (window.__wgHud.shadowRoot &&
              window.__wgHud.shadowRoot.getElementById("aiWindow")?.classList.contains("visible")));

        if (isHudOpen) {
          e.preventDefault();
          e.stopImmediatePropagation();
          window.__wgHud.stopPickQuestionMode();
          window.__wgHud.closeWidget();
          return;
        }
      }

      // Alt + S: Bật/Tắt chế độ Chỉ câu
      if (e.altKey && (e.key === "s" || e.key === "S" || e.code === "KeyS")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        triggerAltS();
        return;
      }

      // Alt + V: Chụp màn hình giải đề bằng AI Vision
      if (e.altKey && (e.key === "v" || e.key === "V" || e.code === "KeyV")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        triggerAltV();
        return;
      }

      // Alt + Q: Giải ngay câu hỏi đang chọn hoặc câu hỏi dưới con trỏ chuột (chỉ chạy 1 lần)
      if (e.altKey && (e.key === "q" || e.key === "Q" || e.code === "KeyQ")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        triggerAltQ();
      }
    },
    true
  );
})();
