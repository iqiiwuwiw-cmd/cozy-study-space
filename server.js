// simple web server for files and sounds
// sends parts of song files when user moves slider

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3005;
const BASE_DIR = path.resolve(__dirname);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg'
};

function reply(res, code, data, extraHeaders = {}) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(typeof data === 'object' ? JSON.stringify(data) : String(data));
  res.writeHead(code, {
    'Content-Length': buf.length,
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders
  });
  res.end(buf);
}

function streamFile(req, res, target) {
  fs.stat(target, (err, st) => {
    if (err || !st.isFile()) {
      return reply(res, 404, { error: 'Not Found' }, { 'Content-Type': 'application/json' });
    }

    const ext = path.extname(target).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const range = req.headers.range;

    // send part of audio file for seeking slider
    if (range && st.size > 0 && range.startsWith('bytes=')) {
      const parts = range.slice(6).split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : st.size - 1;

      if (!isNaN(start) && start <= end && end < st.size) {
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${st.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': (end - start) + 1,
          'Content-Type': type,
          'X-Content-Type-Options': 'nosniff'
        });

        const s = fs.createReadStream(target, { start, end });
        res.on('close', () => s.destroy());
        s.on('error', () => {
          if (!res.headersSent) reply(res, 500, 'Stream error');
          res.end();
        });
        return s.pipe(res);
      }
    }

    res.writeHead(200, {
      'Content-Length': st.size,
      'Content-Type': type,
      'Accept-Ranges': 'bytes',
      'X-Content-Type-Options': 'nosniff'
    });

    const stream = fs.createReadStream(target);
    res.on('close', () => stream.destroy());
    stream.on('error', () => {
      if (!res.headersSent) reply(res, 500, 'Read error');
      res.end();
    });
    stream.pipe(res);
  });
}

const server = http.createServer((req, res) => {
  try {
    const raw = (req.url || '/').split('?')[0];
    const pathname = decodeURIComponent(raw);

    if (pathname === '/api/health') {
      return reply(res, 200, { status: 'healthy', uptime: Math.floor(process.uptime()) }, {
        'Content-Type': 'application/json; charset=utf-8'
      });
    }

    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const abs = path.resolve(BASE_DIR, rel);

    // block requests that try to look outside folder
    if (!abs.startsWith(BASE_DIR) || path.relative(BASE_DIR, abs).startsWith('..')) {
      return reply(res, 403, { error: 'Forbidden' }, { 'Content-Type': 'application/json' });
    }

    streamFile(req, res, abs);
  } catch (err) {
    // bad address letters
    reply(res, 400, 'Bad Request');
  }
});

// close slow web connections
server.requestTimeout = 30000;
server.headersTimeout = 35000;

server.listen(PORT, '0.0.0.0', () => {
  console.log('cozyspace server running at http://localhost:' + PORT);
});

function teardown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 2000);
}

process.on('SIGINT', teardown);
process.on('SIGTERM', teardown);
