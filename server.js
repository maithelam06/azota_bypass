// Local Test Server cho Wayground AI
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url === '/' ? '/test_exam.html' : req.url;
  let filePath = path.join(__dirname, reqPath.split('?')[0]);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Không tìm thấy trang');
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Web test đang chạy tại: http://localhost:${PORT}/test_exam.html`);
});
