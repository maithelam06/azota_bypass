// content/inject.js
// Chạy TRỰC TIẾP trong Page Context (MAIN World) ngay từ document_start
// Vượt qua 100% các lớp giám sát thi: Chuyển tab, mất focus, thoát fullscreen, cấm bôi đen, canvas hook

(function () {
  "use strict";

  if (window.__waygroundMainInjected) return;
  window.__waygroundMainInjected = true;

  // 1. VÔ HIỆU HÓA CÁC THUỘC TÍNH SỰ KIỆN INLINE CẤM COPY / CHỐNG CHUYỂN TAB
  const blockedEvents = [
    "oncopy",
    "oncut",
    "oncontextmenu",
    "onselectstart",
    "ondragstart",
    "onblur",
    "onfocusout",
    "onmouseleave",
    "onfullscreenchange",
    "onwebkitfullscreenchange",
    "onvisibilitychange"
  ];

  function clearInlineAttrs() {
    blockedEvents.forEach((ev) => {
      try {
        if (window[ev]) window[ev] = null;
        if (document[ev]) document[ev] = null;
        if (document.body && document.body[ev]) {
          document.body[ev] = null;
          document.body.removeAttribute?.(ev);
        }
        if (document.documentElement && document.documentElement[ev]) {
          document.documentElement[ev] = null;
          document.documentElement.removeAttribute?.(ev);
        }
      } catch (_) {}
    });
  }

  clearInlineAttrs();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", clearInlineAttrs, { once: true });
  }

  // 2. CHẶN HÀM XÓA VÙNG BÔI ĐEN JS: removeAllRanges / empty
  try {
    if (window.Selection && Selection.prototype) {
      Selection.prototype.removeAllRanges = function () {};
      Selection.prototype.empty = function () {};
    }
  } catch (_) {}

  // 3. GIẢ LẬP TRẠNG THÁI LUÔN FOCUS & VISIBLE (CHỐNG PHÁT HIỆN CHUYỂN TAB / MẤT FOCUS)
  try {
    Object.defineProperty(document, "hidden", { get: () => false, configurable: true });
    Object.defineProperty(document, "webkitHidden", { get: () => false, configurable: true });
    Object.defineProperty(document, "visibilityState", { get: () => "visible", configurable: true });
    Object.defineProperty(document, "webkitVisibilityState", { get: () => "visible", configurable: true });
    document.hasFocus = function () { return true; };
  } catch (_) {}

  // 4. GIẢ LẬP TRẠNG THÁI FULLSCREEN TOÀN DIỆN (CHỐNG PHÁT HIỆN THOÁT TOÀN MÀN HÌNH)
  try {
    let lastFsEl = null;
    const origFs =
      Object.getOwnPropertyDescriptor(Document.prototype, "fullscreenElement") ||
      Object.getOwnPropertyDescriptor(document, "fullscreenElement");

    const getFsEl = function () {
      const real = origFs && origFs.get ? origFs.get.call(this) : null;
      if (real) {
        lastFsEl = real;
        return real;
      }
      return lastFsEl || document.documentElement;
    };

    const applyFsProps = (target) => {
      if (!target) return;
      try {
        Object.defineProperty(target, "fullscreenElement", { get: getFsEl, configurable: true });
        Object.defineProperty(target, "webkitFullscreenElement", { get: getFsEl, configurable: true });
        Object.defineProperty(target, "mozFullScreenElement", { get: getFsEl, configurable: true });
        Object.defineProperty(target, "msFullscreenElement", { get: getFsEl, configurable: true });
        Object.defineProperty(target, "fullscreen", { get: () => true, configurable: true });
        Object.defineProperty(target, "webkitIsFullScreen", { get: () => true, configurable: true });
        Object.defineProperty(target, "mozFullScreen", { get: () => true, configurable: true });
      } catch (_) {}
    };

    applyFsProps(Document.prototype);
    applyFsProps(document);
  } catch (_) {}

  // 5. CANVAS HOOK: BẮT CHỮ TRÊN CÁC TRANG VẼ BẰNG ĐỒ HỌA CANVAS
  try {
    if (window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype) {
      const origFillText = CanvasRenderingContext2D.prototype.fillText;
      const origStrokeText = CanvasRenderingContext2D.prototype.strokeText;
      const recordCanvasText = function (ctx, text) {
        try {
          if (!ctx || !ctx.canvas || !text) return;
          const clean = String(text).trim();
          if (!clean) return;
          const prev = ctx.canvas.getAttribute("data-wg-canvas-text") || "";
          const lines = prev ? prev.split("\n") : [];
          if (!lines.includes(clean)) {
            lines.push(clean);
            ctx.canvas.setAttribute("data-wg-canvas-text", lines.join("\n"));
          }
        } catch (_) {}
      };
      CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
        recordCanvasText(this, text);
        return origFillText.apply(this, arguments);
      };
      CanvasRenderingContext2D.prototype.strokeText = function (text, x, y, maxWidth) {
        recordCanvasText(this, text);
        return origStrokeText.apply(this, arguments);
      };
    }
  } catch (_) {}

  // 6. CHẶN ĐĂNG KÝ EVENT LISTENER GIÁM SÁT THI (WAYGROUND PRO / ANTI-CHEAT MONITOR)
  // Ngăn triệt để trang web gắn hàm bắt sự kiện blur, focusout, visibilitychange, fullscreenchange
  try {
    const origAddEventListener = EventTarget.prototype.addEventListener;
    const proctorEventsBlocked = new Set([
      "visibilitychange",
      "webkitvisibilitychange",
      "mozvisibilitychange",
      "msvisibilitychange",
      "blur",
      "focusout",
      "pagehide",
      "mouseleave",
      "fullscreenchange",
      "webkitfullscreenchange",
      "mozfullscreenchange",
      "msfullscreenchange"
    ]);

    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (typeof type === "string" && proctorEventsBlocked.has(type.toLowerCase())) {
        // Chặn hoàn toàn không cho trang web đăng ký bất kỳ hàm lắng nghe sự kiện thoát toàn màn hình hay rời tab nào
        return;
      }
      return origAddEventListener.call(this, type, listener, options);
    };
  } catch (_) {}

  // 7. BẢO VỆ WINDOW SIZE & GOOGLE LENS RESIZE MONITOR
  // Giữ nguyên kích thước báo cáo tránh bị bắt lỗi Resize / Split screen
  try {
    const origInnerWidth = window.innerWidth;
    const origInnerHeight = window.innerHeight;
    Object.defineProperty(window, "outerWidth", { get: () => window.innerWidth || origInnerWidth, configurable: true });
    Object.defineProperty(window, "outerHeight", { get: () => window.innerHeight || origInnerHeight, configurable: true });
  } catch (_) {}

  // 8. CHẶN CẢNH BÁO VI PHẠM TRÊN MÁY BẠN (SUPPRESS LOCAL PROCTOR WARNINGS / ALERTS)
  // Ngăn trang web bật popup / dialog cảnh báo "Bạn đã thoát toàn màn hình" làm đơ màn hình
  try {
    const origAlert = window.alert;
    const origConfirm = window.confirm;
    const violationKeywords = [
      "toàn màn hình",
      "fullscreen",
      "rời khỏi",
      "chuyển tab",
      "gian lận",
      "vi phạm",
      "giám sát",
      "quá số lần",
      "cảnh báo vi phạm"
    ];

    window.alert = function (msg) {
      const text = String(msg || "").toLowerCase();
      if (violationKeywords.some((kw) => text.includes(kw))) {
        console.warn("[Proctor Shield] Đã chặn cảnh báo toàn màn hình / vi phạm trên máy:", msg);
        return;
      }
      return origAlert.apply(this, arguments);
    };

    window.confirm = function (msg) {
      const text = String(msg || "").toLowerCase();
      if (violationKeywords.some((kw) => text.includes(kw))) {
        console.warn("[Proctor Shield] Đã tự động xác nhận cảnh báo vi phạm:", msg);
        return true;
      }
      return origConfirm.apply(this, arguments);
    };
  } catch (_) {}

  // 9. CHẶN GÓI TIN BÁO CÁO VI PHẠM GỬI VỀ MÁY CHỦ (SERVER TELEMETRY SHIELD)
  // Ngăn các request ngầm gửi thông tin vi phạm thoát fullscreen về server
  try {
    const isViolationPayload = (data) => {
      if (!data) return false;
      const str = typeof data === "string" ? data : JSON.stringify(data);
      const s = str.toLowerCase();
      return (
        s.includes("fullscreen_exit") ||
        s.includes("out_fullscreen") ||
        s.includes("exit_fullscreen") ||
        s.includes("tab_switch") ||
        s.includes("blur_event") ||
        s.includes("leave_exam") ||
        s.includes("violation_type") ||
        s.includes("screen_violation")
      );
    };

    // Chặn gửi qua navigator.sendBeacon
    if (navigator.sendBeacon) {
      const origSendBeacon = navigator.sendBeacon;
      navigator.sendBeacon = function (url, data) {
        if (isViolationPayload(data)) {
          console.warn("[Proctor Shield] Đã chặn gói tin báo vi phạm gửi về máy chủ (sendBeacon):", url);
          return true; // Giả lập gửi thành công
        }
        return origSendBeacon.apply(this, arguments);
      };
    }

    // Chặn gửi qua fetch
    const origFetch = window.fetch;
    window.fetch = function (resource, init) {
      const body = init?.body;
      if (body && isViolationPayload(body)) {
        console.warn("[Proctor Shield] Đã chặn gói tin báo vi phạm gửi về máy chủ (fetch):", resource);
        return Promise.resolve(
          new Response(JSON.stringify({ success: true, message: "OK", code: 200 }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        );
      }
      return origFetch.apply(this, arguments);
    };
  } catch (_) {}
})();
