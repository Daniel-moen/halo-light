// Tiny zero-dependency static server for the production build (dist/).
// Usage: node server.mjs [port] [host]   (defaults 8050, 0.0.0.0)
// DIST=dist-pages BASE=/halo-light/ serves the Pages build under that path, like GitHub Pages does.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL(`./${process.env.DIST ?? 'dist'}`, import.meta.url)));
const port = Number(process.argv[2] ?? process.env.PORT ?? 8050);
const host = process.argv[3] ?? process.env.HOST ?? '0.0.0.0';
const base = (process.env.BASE ?? '/').replace(/\/?$/, '/');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function fileFor(urlPath) {
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  const full = join(root, rel);
  if (!full.startsWith(root)) return null;
  try {
    const st = statSync(full);
    if (st.isDirectory()) return fileFor(join(urlPath, 'index.html'));
    return { full, st };
  } catch {
    return null;
  }
}

createServer((req, res) => {
  let path;
  try {
    path = new URL(req.url, 'http://x').pathname;
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (base !== '/') {
    if (path === base.slice(0, -1)) {
      res.writeHead(301, { Location: base }).end();
      return;
    }
    if (!path.startsWith(base)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    path = path.slice(base.length - 1);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  // Unknown paths without an extension get the app shell.
  const hit = fileFor(path) ?? (extname(path) ? null : fileFor('/index.html'));
  if (!hit) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return;
  }
  const headers = {
    'Content-Type': TYPES[extname(hit.full)] ?? 'application/octet-stream',
    'Content-Length': hit.st.size,
    'Cache-Control': path.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  };
  res.writeHead(200, headers);
  if (req.method === 'HEAD') res.end();
  else createReadStream(hit.full).pipe(res);
}).listen(port, host, () => {
  console.log(`Halo Light serving ${root} on http://${host}:${port}${base}`);
});
