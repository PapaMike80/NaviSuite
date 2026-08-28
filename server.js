const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {execFile} = require('child_process');

const root = __dirname;
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.pdf':'application/pdf','.csv':'text/csv; charset=utf-8','.txt':'text/plain; charset=utf-8','.md':'text/markdown; charset=utf-8'};
const MAX_OCR_IMAGE_BYTES = 10 * 1024 * 1024;

function sendJson(res, status, body) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(body));
}

function readBody(req, limit = MAX_OCR_IMAGE_BYTES * 2) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Immagine OCR troppo grande'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function recognizeOcrImage(dataUrl) {
  const match = String(dataUrl || '').match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) throw new Error('Formato immagine OCR non valido');
  const image = Buffer.from(match[2], 'base64');
  if (!image.length || image.length > MAX_OCR_IMAGE_BYTES) throw new Error('Immagine OCR non valida o troppo grande');
  const folder = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'navisuite-ocr-'));
  const input = path.join(folder, `page.${match[1].toLowerCase() === 'jpeg' ? 'jpg' : 'png'}`);
  try {
    await fs.promises.writeFile(input, image);
    const text = await new Promise((resolve, reject) => execFile('tesseract', [input, 'stdout', '-l', 'eng', '--psm', '6'], {timeout:30000,maxBuffer:1024 * 1024}, (error, stdout, stderr) => {
      if (error) reject(new Error(`OCR non disponibile: ${stderr || error.message}`));
      else resolve(stdout);
    }));
    return String(text || '');
  } finally {
    await fs.promises.rm(folder, {recursive:true,force:true});
  }
}

http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url.split('?')[0] === '/api/ocr') {
    try {
      const payload = JSON.parse((await readBody(req)).toString('utf8'));
      const text = await recognizeOcrImage(payload.image);
      sendJson(res, 200, {text});
    } catch (error) {
      sendJson(res, 422, {error:error.message || 'OCR non riuscito'});
    }
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, {'Content-Type':'text/plain; charset=utf-8'}).end('Method not allowed');
    return;
  }
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
