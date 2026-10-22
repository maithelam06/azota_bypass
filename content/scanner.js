// content/scanner.js
// Thuật toán nhận diện câu hỏi từ DOM, bóc tách đáp án A/B/C/D & Hook đồ họa Canvas

(function () {
  "use strict";

  // 1. Cài đặt Canvas Hook vào trang để bắt trọn từng dòng chữ vẽ bằng đồ họa
  try {
    const script = document.createElement("script");
    script.textContent = `
      (function() {
        if (window.__waygroundCanvasHookInstalled) return;
        window.__waygroundCanvasHookInstalled = true;
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
        } catch(_) {}
      })();
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  } catch (_) {}

  const QUESTION_CONTAINER_SELECTORS = [
    // Azota specific selectors
    "app-test-content-item",
    ".app-test-content-item",
    ".test-content-item",
    ".view-question",
    ".item-question",
    ".item-question-content",
    ".azota-question",
    "[class*='item-quest']",
    "[class*='question-item']",
    "[class*='question_item']",
    "[class*='view-question']",
    "[class*='test-content']",
    "[class*='Azota']",
    "[class*='azota']",
    "[id*='question-']",
    "[id*='quest_']",
    // Generic exam selectors
    ".question-card",
    ".question-box",
    ".quiz-question",
    "[data-test='question-container']",
    "[class*='question-container']",
    "[class*='QuestionCard']",
    "[class*='QuestionBox']",
    ".que",
    ".freebirdFormviewerComponentsQuestionBaseRoot",
    ".Qr7Oae",
    ".ant-card",
    ".question-content"
  ];

  window.__wgScanner = {
    getDeepElementAtPoint(x, y, ignoreContainer) {
      try {
        const els = document.elementsFromPoint(x, y);
        for (const el of els) {
          if (ignoreContainer && (el === ignoreContainer || ignoreContainer.contains(el))) continue;
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
    },

    getCleanTextFromNode(node) {
      if (!node) return "";
      const ignoredElements = new Set();
      try {
        if (node.querySelectorAll) {
          node.querySelectorAll("[data-wg-ignore], .watermark-shield").forEach((el) => {
            ignoredElements.add(el);
          });
        }
      } catch (_) {}

      const savedDisplays = [];
      ignoredElements.forEach((el) => {
        savedDisplays.push({ el, display: el.style.display });
        el.style.display = "none";
      });

      let raw = (node.innerText || node.textContent || "").trim();

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
    },

    findBestQuestionContainer(el) {
      if (!el || el === document.body || el === document.documentElement) return null;

      for (const sel of QUESTION_CONTAINER_SELECTORS) {
        try {
          const matched = el.closest(sel);
          if (matched) {
            const txt = this.getCleanTextFromNode(matched);
            if (txt.length >= 15 && txt.length <= 4000) {
              return matched;
            }
          }
        } catch (_) {}
      }

      let curr = el;
      let bestCandidate = el;
      let maxScore = -1;

      while (curr && curr !== document.body && curr !== document.documentElement) {
        const txt = this.getCleanTextFromNode(curr);
        const rect = curr.getBoundingClientRect();
        if (
          txt.length >= 20 &&
          txt.length <= 3500 &&
          rect.height >= 25
        ) {
          let score = 0;
          const hasQNum = /(?:Câu|Question|Bài)\s*(\d+)/i.test(txt);
          const hasOptions =
            /(?:^|\n|\s)\s*[A-F](?:[\.\)\:\-]|\s+|\n)/m.test(txt) ||
            curr.querySelectorAll("input[type='radio'], input[type='checkbox'], label, button, [role='radio'], [class*='option'], [class*='answer'], [class*='circle']").length >= 2;

          if (hasQNum) score += 5;
          if (hasOptions) score += 5;
          if (txt.length >= 35 && txt.length <= 1500) score += 2;
          if (rect.height <= window.innerHeight * 0.95) score += 2;

          if (score > maxScore) {
            maxScore = score;
            bestCandidate = curr;
          }

          if (hasQNum && hasOptions && rect.height <= window.innerHeight * 0.95) {
            return curr;
          }
        }
        if (txt.length > 4000) break;
        curr = curr.parentElement;
      }

      return bestCandidate;
    },

    extractQuestionFromElement(el) {
      const container = this.findBestQuestionContainer(el);
      if (!container) return null;
      const text = this.getCleanTextFromNode(container);
      return text.length >= 10 ? text : null;
    },

    scanAllQuestionsOnPage(ignoreContainer) {
      const results = [];
      const seenTexts = new Set();

      // 1. Quét theo danh sách bộ chọn (selectors)
      for (const sel of QUESTION_CONTAINER_SELECTORS) {
        try {
          const nodes = document.querySelectorAll(sel);
          if (nodes.length > 0) {
            nodes.forEach((node) => {
              if (ignoreContainer && ignoreContainer.contains(node)) return;
              const txt = this.getCleanTextFromNode(node);
              if (txt.length >= 20 && txt.length <= 3500 && !seenTexts.has(txt)) {
                const hasQNum = /(?:Câu|Question|Bài)\s*(\d+)/i.test(txt);
                const hasOptions =
                  /(?:^|\n|\s)\s*[A-F][\.\)\:\-\s]/m.test(txt) ||
                  node.querySelectorAll("input[type='radio'], label, button, [class*='option'], [class*='answer'], [class*='circle']").length >= 2;

                if (hasQNum || hasOptions || txt.length >= 40) {
                  seenTexts.add(txt);
                  const matchNum = txt.match(/(?:Câu|Question|Bài)\s*(\d+)/i);
                  results.push({
                    element: node,
                    label: matchNum ? `Câu ${matchNum[1]}` : `Câu ${results.length + 1}`,
                    text: txt
                  });
                }
              }
            });
            if (results.length > 0) return results;
          }
        } catch (_) {}
      }

      // 2. Tìm tất cả các tiêu đề câu hỏi (Question X / Câu X) rồi bọc container chuẩn
      try {
        const headerCandidates = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6, b, strong, div, span, p"));
        for (const h of headerCandidates) {
          if (ignoreContainer && ignoreContainer.contains(h)) continue;
          if (h.children.length > 3) continue;
          const t = (h.textContent || "").trim();
          const matchNum = t.match(/^(?:Câu|Question|Bài)\s*(\d+)\b/i);
          if (matchNum) {
            const container = this.findBestQuestionContainer(h);
            if (container) {
              const txt = this.getCleanTextFromNode(container);
              if (txt.length >= 20 && !seenTexts.has(txt)) {
                seenTexts.add(txt);
                results.push({
                  element: container,
                  label: `Câu ${matchNum[1]}`,
                  text: txt
                });
              }
            }
          }
        }
        if (results.length > 0) return results;
      } catch (_) {}

      // 3. Quét dự phòng tất cả các block trên trang
      const allBlocks = Array.from(document.querySelectorAll("div, section, article, li, fieldset"));
      for (const block of allBlocks) {
        if (ignoreContainer && ignoreContainer.contains(block)) continue;
        const txt = this.getCleanTextFromNode(block);
        if (txt.length < 25 || txt.length > 2500) continue;

        const matchNum = txt.match(/(?:Câu|Question|Bài)\s*(\d+)/i);
        const hasOptions =
          /(?:^|\n|\s)\s*[A-F][\.\)\:\-\s]/m.test(txt) ||
          block.querySelectorAll("input[type='radio'], input[type='checkbox'], label, button, [role='radio'], [class*='option'], [class*='answer'], [class*='circle']").length >= 2;

        if (matchNum || hasOptions) {
          const isDuplicate = Array.from(seenTexts).some(
            (existing) => existing.includes(txt) || txt.includes(existing)
          );
          if (!isDuplicate) {
            seenTexts.add(txt);
            results.push({
              element: block,
              label: matchNum ? `Câu ${matchNum[1]}` : `Câu ${results.length + 1}`,
              text: txt
            });
          }
        }
      }

      return results;
    },

    findQuestionClosestToViewportCenter(questions) {
      if (!questions || questions.length === 0) return 0;
      const centerY = window.innerHeight / 2;
      let bestIdx = 0;
      let minDistance = Infinity;

      questions.forEach((q, idx) => {
        if (!q.element) return;
        const rect = q.element.getBoundingClientRect();
        const elementCenterY = rect.top + rect.height / 2;
        const dist = Math.abs(elementCenterY - centerY);
        if (dist < minDistance) {
          minDistance = dist;
          bestIdx = idx;
        }
      });

      return bestIdx;
    },

    findActiveQuestionInViewport(ignoreContainer) {
      try {
        const questions = this.scanAllQuestionsOnPage(ignoreContainer);
        if (questions && questions.length > 0) {
          const targetY = window.innerHeight * 0.45;
          let bestQ = null;
          let minDistance = Infinity;

          for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.element) continue;
            const rect = q.element.getBoundingClientRect();
            // Câu hỏi phải hiển thị ít nhất một phần trong viewport
            if (rect.bottom > 80 && rect.top < window.innerHeight - 80) {
              const qCenterY = rect.top + Math.min(rect.height, window.innerHeight * 0.5) / 2;
              const dist = Math.abs(qCenterY - targetY);
              if (dist < minDistance) {
                minDistance = dist;
                bestQ = { ...q, index: i };
              }
            }
          }
          if (bestQ) return bestQ;
        }

        // Dự phòng: Tìm phần tử tại các điểm giữa màn hình
        const testPoints = [
          { x: window.innerWidth * 0.5, y: window.innerHeight * 0.4 },
          { x: window.innerWidth * 0.5, y: window.innerHeight * 0.55 },
          { x: window.innerWidth * 0.5, y: window.innerHeight * 0.25 }
        ];

        for (const pt of testPoints) {
          const deepEl = this.getDeepElementAtPoint(pt.x, pt.y, ignoreContainer);
          if (deepEl) {
            const container = this.findBestQuestionContainer(deepEl);
            if (container) {
              const txt = this.getCleanTextFromNode(container);
              if (txt && txt.length >= 15) {
                const matchNum = txt.match(/(?:Câu|Question|Bài)\s*(\d+)/i);
                return {
                  element: container,
                  label: matchNum ? `Câu ${matchNum[1]}` : "Câu hỏi",
                  text: txt,
                  index: -1
                };
              }
            }
          }
        }
      } catch (_) {}
      return null;
    }
  };
})();
