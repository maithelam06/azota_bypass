# 👑 Wayground & Azota AI PRO - Hệ Thống Trợ Lý Thi Cử & Bypass Chống Gian Lận (Lâm Dev)

> **Bản quyền phát triển:** Lâm Dev  
> **Phiên bản:** 4.0.0 (Pro Max Stealth)  
> **Nền tảng hỗ trợ chuyên sâu:** Wayground (Quizizz) & Azota (hỗ trợ thêm mọi trang thi trắc nghiệm khác)

---

## ⚡ TÓM TẮT CHỨC NĂNG NỔI BẬT

1. **Hỗ trợ tối ưu song song 2 nền tảng lớn (Wayground & Azota):**
   - Tự động nhận diện cấu trúc đề: Quizizz (thẻ màu, màn hình full) và Azota (danh sách câu hỏi cuộn dài `Question 1`, `Question 2`...).
2. **Hệ Thống Bypass Giám Sát Chống Gian Lận 100% (Anti-Proctor Stealth):**
   - Can thiệp ở tầng sâu nhất (`MAIN` World - [content/inject.js](file:///d:/extension%20way/content/inject.js)) trước khi trang thi kịp nạp script giám sát.
   - **Chống bắt chuyển tab / Rời màn hình:** Ghi đè `document.hidden = false`, `visibilityState = "visible"`, `document.hasFocus = () => true`.
   - **Chống phát hiện thoát toàn màn hình (Fullscreen):** Giả lập `document.fullscreen = true` và `document.fullscreenElement`.
   - **Chặn trang web gắn Event Listener theo dõi:** Vô hiệu hóa việc đăng ký các sự kiện `blur`, `focusout`, `visibilitychange`, `pagehide`, `mouseleave`.
   - **Mở khóa sao chép & bôi đen:** Phá bỏ CSS cấm bôi đen, xóa bỏ lớp phủ `watermark-shield` chặn click.
3. **Tự Động Ấn Vào Đáp Án Đúng (Auto-Click):**
   - Khi AI giải xong, tiện ích tự tìm đúng phần tử đáp án (A/B/C/D) trên trang và kích hoạt click thật với độ trễ tự nhiên (human-like delay).
4. **Tàng hình tuyệt đối (Zero-Trace):**
   - Đã gỡ bỏ toàn bộ việc vẽ viền xanh và nhãn "ĐÁP ÁN" trên trang web, tránh bị giám thị hoặc công cụ chụp màn hình phát hiện.
5. **Đa mô hình AI (Multi-Model):**
   - Tích hợp linh hoạt: **Groq** (Llama 3.3 70B miễn phí ~0.2s), **Gemini** (3.8 Flash), **DeepSeek** (V3 & R1 giải toán), **OpenAI ChatGPT** (GPT-4o), **OpenRouter** (Free).

---

## 📖 HƯỚNG DẪN SỬ DỤNG (HDSD)

### Bước 1: Cài đặt và Kiểm tra ban đầu
1. Mở tiện ích bằng cách bấm icon trên thanh công cụ trình duyệt (Popup).
2. Chọn nhà cung cấp AI muốn dùng (Khuyên dùng **Groq** lấy key miễn phí hoặc **Gemini**).
3. Dán **API Key** vào ô tương ứng.
4. Bấm nút **"⚡ Kiểm Tra Kết Nối API Ngay"** để kiểm tra key đã hoạt động chuẩn chưa.
5. Bấm **"💾 Lưu & Sẵn Sàng Làm Bài"**.

### Bước 2: Vào làm bài thi
- Truy cập vào trang thi trắc nghiệm (Wayground, Quizizz hoặc Azota).
- Tiện ích sẽ tự động nhận diện nền tảng và hiển thị thanh điều khiển nổi (HUD) ở góc phải màn hình.

### Bước 3: Ba cách kích hoạt giải đề
* **Cách 1 (Nhanh nhất - Phím tắt):**
  - Dùng chuột bôi đen câu hỏi và các đáp án ➔ Bấm phím nóng <kbd>Alt + Q</kbd>.
  - AI sẽ phân tích và hiển thị ngay đáp án đúng trong tích tắc.
* **Cách 2 (Chỉ điểm câu hỏi):**
  - Bấm nút **"👆 Chỉ câu"** (hoặc bấm <kbd>Alt + S</kbd>).
  - Di chuột và nhấp chuột trái vào câu hỏi cần giải.
* **Cách 3 (Tự động quét & Cuộn tra):**
  - Bật nút **"📜 Cuộn tra"** hoặc bấm **"🔍 Quét đề"**: Tiện ích sẽ tự đọc đề trên màn hình khi bạn lăn chuột.

### Bước 4: Chế độ Tự Động Ấn Đáp Án (Auto-Click)
- Bật nút **"⚡ Tự ấn"** trên thanh HUD hoặc gạt công tắc trong Popup.
- Khi AI tìm ra đáp án đúng (A, B, C hoặc D), tiện ích sẽ **tự động click chọn ngay** phương án đó trên trang bài thi.

### Bước 5: Các phím tắt tiện lợi
- <kbd>Ctrl</kbd>: **Tắt / Ẩn nhanh HUD ngay lập tức** (chỉ 1 phím một chạm khi cần tàng hình khẩn cấp).
- <kbd>Alt + Q</kbd>: Kích hoạt giải câu đang bôi đen / mở lại HUD.
- <kbd>Alt + H</kbd>: Ẩn nhanh HUD (Alt + X để thu gọn).
- <kbd>Alt + S</kbd>: Bật chế độ Chỉ điểm câu hỏi.
- Nút **❓** trên thanh tiêu đề HUD: Bấm để mở bảng tóm tắt HDSD ngay trên trang thi mà không cần mở Popup.

---

## 📂 Sơ Đồ Cấu Trúc Thư Mục (Project Architecture)

```text
d:/extension way/
├── 📄 manifest.json                  # File cấu hình trung tâm của Chrome Extension (Manifest V3)
│
├── 📁 popup/                         # Giao diện cài đặt khi bấm vào biểu tượng Extension
│   ├── 📄 popup.html                 # HTML giao diện cài đặt API Key, Model & Chế độ giải
│   ├── 📄 popup.css                  # Giao diện Dark Mode tím neon hiện đại
│   └── 📄 popup.js                   # Logic lưu chrome.storage, kiểm tra kết nối API tức thì
│
├── 📁 background/                    # Service Worker chạy ngầm (Sử dụng ES Module `import/export`)
│   ├── 📄 index.js                   # Điểm khởi chạy (Entry point): lắng nghe Message, Context Menu, Dispatch
│   ├── 📄 prompts.js                 # Bộ System Prompts chống bẫy đề thi, luật chốt đáp án 10/10
│   ├── 📄 vision.js                  # Xử lý chụp ảnh màn hình, Canvas crop & AI Vision
│   └── 📁 providers/                 # Các module gọi API AI riêng biệt
│       ├── 📄 groq.js                # Groq Cloud siêu tốc (Llama-3.3-70b, DeepSeek-R1-70b, auto retry 429)
│       ├── 📄 gemini.js              # Google Gemini API (Gemini 2.5 Flash, 2.0 Flash Lite)
│       ├── 📄 deepseek.js            # DeepSeek V3 (Chat) & R1 (Reasoner)
│       ├── 📄 openai.js              # OpenAI ChatGPT (GPT-4o-mini, GPT-4o)
│       └── 📄 openrouter.js          # OpenRouter đa mô hình miễn phí
│
├── 📁 content/                       # Mã nguồn nhúng trực tiếp vào các tab trang web thi
│   ├── 📄 bypass.js                  # Bypass 100%: Mở khóa copy, chuột phải, bôi đen, chống anti-cheat
│   ├── 📄 scanner.js                 # Bóc tách DOM câu hỏi, Hook Canvas HTML5, quét danh sách câu
│   ├── 📄 hud.js                     # Bảng điều khiển nổi HUD bằng Shadow DOM (kéo thả, đổi model inline)
│   └── 📄 index.js                   # Điều phối sự kiện trang web, bắt bôi đen & tổ hợp phím tắt
│
└── 📁 icons/                         # Bộ icon tiện ích các kích thước 16px, 48px, 128px
```

---

## 🧠 Chi Tiết Từng Phần Để Bạn Học Tập & Nắm Vững

### 1. File Trung Tâm: `manifest.json`
- **Vai trò**: "Khai sinh" cho tiện ích với trình duyệt Chrome/Edge.
- **Khai báo Service Worker dạng Module**:
  ```json
  "background": {
    "service_worker": "background/index.js",
    "type": "module"
  }
  ```
  Nhờ `"type": "module"`, bạn có thể dùng cú pháp `import { ... } from './...'` chuẩn ES6 trong thư mục `background/`.
- **Khai báo Content Scripts**: Nạp tuần tự `bypass.js` ➔ `scanner.js` ➔ `hud.js` ➔ `index.js` ngay từ `document_start` để vô hiệu hóa rào cản trang web ngay khi trang vừa tải.

---

### 2. Thư Mục `popup/` (Giao Diện Cài Đặt)
- [popup/popup.html](file:///d:/extension%20way/popup/popup.html): Chứa các tab chọn nhà cung cấp AI (Groq, Gemini, DeepSeek, ChatGPT, OpenRouter), ô nhập API Key, chọn model và chế độ giải (Siêu tốc / Cân bằng / Tư duy sâu).
- [popup/popup.js](file:///d:/extension%20way/popup/popup.js): 
  - Đọc và ghi cấu hình người dùng vào `chrome.storage.local`.
  - Có nút **"⚡ Kiểm Tra Kết Nối API Ngay"** gửi action `TEST_API_CONNECTION` sang background để đo ping (ms) và xác thực key trước khi thi.

---

### 3. Thư Mục `background/` (Xử Lý Ngầm & Gọi AI)
Service Worker là "bộ não ngầm" của tiện ích, không bị giới hạn bởi CORS của trang web:
- [background/index.js](file:///d:/extension%20way/background/index.js): Lắng nghe `chrome.runtime.onMessage`, định tuyến yêu cầu `CALL_AI_API`, `CAPTURE_AND_SOLVE`, `TEST_API_CONNECTION`, đồng thời tự động bơm lại script vào các tab khi bạn vừa cập nhật extension.
- [background/prompts.js](file:///d:/extension%20way/background/prompts.js): Chứa prompt chuyên sâu:
  - Ép AI kiểm tra từ bẫy phủ định: *"KHÔNG", "SAI", "NGOẠI TRỪ"*.
  - Định dạng chuẩn: `👉 ĐÁP ÁN: [A/B/C/D] - [Nội dung cụ thể]` kèm `💡 Căn cứ: [1 câu ngắn]` giúp bạn bấm trắc nghiệm chuẩn 10/10 ngay cả khi đáp án bị đảo lộn thứ tự.
- [background/vision.js](file:///d:/extension%20way/background/vision.js):
  - Nhận toạ độ câu hỏi hoặc canvas từ content script.
  - Sử dụng `chrome.tabs.captureVisibleTab` để chụp ảnh màn hình ngầm.
  - Chuyển thành Base64 rồi gửi thẳng tới Gemini Multimodal Vision hoặc OpenAI Vision để giải các câu hỏi chứa biểu đồ, hình vẽ, ký hiệu toán học.
- [background/providers/](file:///d:/extension%20way/background/providers/):
  - Tách riêng từng file nhà cung cấp AI. Muốn thêm nhà cung cấp mới (ví dụ Claude, Cohere), chỉ cần tạo thêm 1 file trong thư mục này mà không sợ làm hỏng code hiện có.

---

### 4. Thư Mục `content/` (Chạy Trong Trang Web Thi)
Content Scripts tương tác trực tiếp với DOM của trang web:
- [content/bypass.js](file:///d:/extension%20way/content/bypass.js):
  - Gỡ bỏ thuộc tính CSS `user-select: none`, `-webkit-user-select: none`.
  - Chặn triệt để các event listener `copy`, `cut`, `contextmenu`, `selectstart`, `keydown`.
  - Vô hiệu hóa hàm `window.getSelection().removeAllRanges()` mà các trang thi dùng để xóa vùng bôi đen.
  - Vượt rào kiểm tra anti-cheat (chống cảnh báo khi mất tiêu điểm tab hoặc ấn phím PrintScreen).
- [content/scanner.js](file:///d:/extension%20way/content/scanner.js):
  - **Hook Canvas 2D**: Can thiệp vào `CanvasRenderingContext2D.prototype.fillText` để "đọc trộm" chữ vẽ trên Canvas (đối phó các trang vẽ đề thi lên thẻ `<canvas>` để chống copy).
  - Tự động quét và nhận diện vùng chứa câu hỏi, gom nhóm câu hỏi trắc nghiệm `[Câu 1..N]`.
- [content/hud.js](file:///d:/extension%20way/content/hud.js):
  - Tạo bảng nổi HUD trực tiếp trên màn hình bằng kỹ thuật **Shadow DOM** (`mode: 'closed'`), giúp web thi **hoàn toàn không thể phát hiện** được tiện ích đang chạy.
  - Cung cấp 5 nút thao tác nhanh:
    - 📜 **Cuộn tra**: Tự động nhận diện & giải câu hỏi khi người dùng lăn chuột, không cần bôi đen (có bộ nhớ đệm Cache 0s).
    - 🎯 **Bôi đen**: Giải vùng chữ vừa chọn.
    - 👆 **Chỉ câu**: Bật chế độ trỏ chuột vào câu hỏi bất kỳ trên màn hình để giải ngay.
    - 🔍 **Quét đề**: Quét toàn bộ trang tìm các câu hỏi thành danh sách nút `[Câu 1..N]`.
    - 📸 **Chụp**: Kéo chuột khoanh vùng chụp ảnh màn hình câu hỏi vẽ bằng Canvas.
  - Có thanh chọn Model AI trực tiếp ngay trên bảng HUD (không cần mở popup tiện ích để đổi).
- [content/index.js](file:///d:/extension%20way/content/index.js):
  - File kết nối và điều phối toàn bộ các module trên.
  - Quản lý các phím tắt toàn cục:
    - <kbd>Alt + A</kbd>: Bật / Tắt chế độ Lăn chuột tự tra (Auto-Scroll Solver).
    - <kbd>Alt + Q</kbd>: Giải ngay câu hỏi đang bôi đen hoặc dưới con trỏ chuột.
    - <kbd>Alt + S</kbd>: Bật chế độ trỏ câu hỏi (Pick question).
    - <kbd>Alt + V</kbd>: Bật chế độ chụp màn hình giải bài.
    - <kbd>Ctrl</kbd>: Tắt / Ẩn nhanh bảng HUD ngay lập tức (1 phím một chạm).
    - <kbd>Alt + H</kbd>: Ẩn nhanh thanh điều khiển HUD.
    - <kbd>Alt + X</kbd>: Thu gọn kết quả.

---

## 🚀 Cách Tải Lại Tiện Ích Lên Trình Duyệt

1. Mở Chrome/Edge, vào: `chrome://extensions` (hoặc `edge://extensions`).
2. Gạt công tắc **"Chế độ dành cho nhà phát triển" (Developer mode)** sang **BẬT (ON)**.
3. Bấm nút **"Tải tiện ích đã giải nén" (Load unpacked)** ➔ Chọn thư mục:
   ```text
   d:\extension way
   ```
4. Bấm **icon xoay vòng 🔄 (Reload)** tại tiện ích Wayground AI để áp dụng cấu trúc mới.
