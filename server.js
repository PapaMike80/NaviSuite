const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.pdf':'application/pdf','.csv':'text/csv; charset=utf-8','.txt':'text/plain; charset=utf-8','.md':'text/markdown; charset=utf-8'};

http.createServer((req, res) => {
  const requested = decodeURIComponent(req.url.split('?')[0]);
  const relative = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}).end('Not found');
      return;
    }
    res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-cache'});
    res.end(data);
  });
}).listen(8765, process.env.HOST || '0.0.0.0');
