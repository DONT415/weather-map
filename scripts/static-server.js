
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.FRONTEND_PORT || 5500;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8'
};

// Chặn theo TÊN TỪNG SEGMENT trong đường dẫn (không phải chặn theo chuỗi
// toàn bộ URL), để không thể lách qua bằng encode ký tự hay thêm "./".
function isBlockedPath(urlPath) {
  const segments = urlPath.split('/').filter(Boolean);
  return segments.some(function (segment) {
    return segment.toLowerCase() === 'server' || segment.startsWith('.');
  });
}

const server = http.createServer(function (req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch (e) {
    res.writeHead(400);
    res.end('400 - URL không hợp lệ.');
    return;
  }

  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  if (isBlockedPath(urlPath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 - Không được phép truy cập đường dẫn này.');
    return;
  }

  const filePath = path.join(ROOT, urlPath);

  // Chốt chặn thứ 2 (phòng hờ): đảm bảo file thật sự nằm trong ROOT.
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 - Forbidden.');
    return;
  }

  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 - Không tìm thấy: ' + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
});

server.listen(PORT, function () {
  console.log(`Frontend đang chạy tại http://localhost:${PORT}`);
});
