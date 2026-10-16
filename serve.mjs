// Zero-dependency static server for the walkthrough.
// The project has no build step, so this is all that is needed to run it:
//   node serve.mjs [port]
//
// It sends no-store so editing a module and reloading always shows the change.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.argv[2] || 8741);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.hdr': 'application/octet-stream',
  '.wasm': 'application/wasm',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const target = resolve(join(root, normalize(path)));
    if (!target.startsWith(root)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const info = await stat(target);
    if (info.isDirectory()) {
      res.writeHead(302, { Location: path + '/' }).end();
      return;
    }
    const body = await readFile(target);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(target).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Cache-Control': 'no-store' });
    res.end(String(err.message || err));
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`一栋住宅 · http://127.0.0.1:${port}/`);
});
