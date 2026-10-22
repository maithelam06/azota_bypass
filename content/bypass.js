// content/bypass.js
// Mô-đun Mở Khóa Bôi Đen 100% & Chống Phát Hiện Giám Sát Thi (Proctor Bypass)

(function () {
  "use strict";

  window.__wgBypass = {
    unblockCopyEnabled: true,
    stealthMode: false,
    listenersInstalled: false,

    unlockAttributesAndStyles() {
      if (!this.unblockCopyEnabled) return;
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
      const parent = document.head || document.documentElement;
      if (parent && style.parentNode !== parent) {
        parent.appendChild(style);
      }

      // Xóa các thuộc tính inline cấm bôi đen/copy trên html và body
      const inlineAttrs = ["oncopy", "oncut", "oncontextmenu", "onselectstart", "ondragstart"];
      const targets = [document.documentElement, document.body].filter(Boolean);
      targets.forEach((el) => {
        inlineAttrs.forEach((attr) => {
          try {
            if (el.hasAttribute && el.hasAttribute(attr)) el.removeAttribute(attr);
            el[attr] = null;
          } catch (_) {}
        });
      });
    },

    initAntiCopyAndProctorBypass() {
      this.unlockAttributesAndStyles();

      if (!this.listenersInstalled) {
        this.listenersInstalled = true;

        window.addEventListener("mousedown", () => this.unlockAttributesAndStyles(), true);

        // Chặn các sự kiện cấm copy / bôi đen
        const blockCopyEvents = ["copy", "cut", "contextmenu", "selectstart", "dragstart"];
        blockCopyEvents.forEach((evtName) => {
          const handler = (e) => {
            if (this.unblockCopyEnabled) e.stopImmediatePropagation();
          };
          window.addEventListener(evtName, handler, true);
          document.addEventListener(evtName, handler, true);
        });

        // Chặn các sự kiện theo dõi chuyển tab / mất focus
        const proctorEvents = ["visibilitychange", "webkitvisibilitychange", "blur", "focusout", "mouseleave", "pagehide"];
        proctorEvents.forEach((evtName) => {
          const handler = (e) => e.stopImmediatePropagation();
          window.addEventListener(evtName, handler, true);
          document.addEventListener(evtName, handler, true);
        });

        // Chặn sự kiện thoát Fullscreen
        const fsEvents = ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"];
        fsEvents.forEach((evtName) => {
          document.addEventListener(
            evtName,
            (e) => {
              if (window.__wgHud && window.__wgHud.ensureHudInsideFullscreen) {
                window.__wgHud.ensureHudInsideFullscreen();
              }
              e.stopImmediatePropagation();
            },
            true
          );
        });

        // Chặn phát hiện phím chụp màn hình (PrintScreen, Win+Shift+S) & phím tắt của Extension
        const shieldKeyEvent = (e) => {
          const k = (e.key || "").toLowerCase();
          const isPrintScreen = e.key === "PrintScreen" || e.code === "PrintScreen" || e.keyCode === 44;
          const isSnippingShortcut = e.metaKey && e.shiftKey && (k === "s" || k === "3" || k === "4" || k === "5");
          const isExtensionHotkey = e.altKey && (k === "q" || k === "s" || k === "v" || k === "h" || k === "x");

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

      // Tiêm script vào ngữ cảnh trang (Page Context)
      try {
        const script = document.createElement("script");
        script.textContent = `
          (function() {
            const clearEvents = ['oncopy', 'oncut', 'oncontextmenu', 'onselectstart', 'ondragstart', 'onblur', 'onfocusout', 'onmouseleave', 'onfullscreenchange', 'onwebkitfullscreenchange', 'onvisibilitychange'];
            clearEvents.forEach(ev => {
              try {
                document[ev] = null; window[ev] = null;
                if (document.body) { document.body[ev] = null; document.body.removeAttribute(ev); }
                if (document.documentElement) { document.documentElement[ev] = null; document.documentElement.removeAttribute(ev); }
              } catch(e){}
            });

            if (window.__waygroundAntiProctorInstalled) return;
            window.__waygroundAntiProctorInstalled = true;

            // Vô hiệu hóa lệnh xóa vùng bôi đen bằng JS: window.getSelection().removeAllRanges()
            try {
              if (window.Selection && Selection.prototype) {
                Selection.prototype.removeAllRanges = function() {};
                Selection.prototype.empty = function() {};
              }
            } catch(e) {}

            // Giả lập trạng thái luôn đang Focus & Visible
            try {
              Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
              Object.defineProperty(document, 'webkitHidden', { get: () => false, configurable: true });
              Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
              Object.defineProperty(document, 'webkitVisibilityState', { get: () => 'visible', configurable: true });
              document.hasFocus = function() { return true; };
            } catch(e) {}

            // Giả lập trạng thái Fullscreen
            try {
              let lastFsEl = null;
              const origFs = Object.getOwnPropertyDescriptor(Document.prototype, 'fullscreenElement') ||
                             Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
              if (origFs && origFs.get) {
                Object.defineProperty(document, 'fullscreenElement', {
                  get: function() {
                    const real = origFs.get.call(this);
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
  };
})();
