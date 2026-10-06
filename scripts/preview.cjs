const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { normalizeBasePath } = require('../build/helpers/urls.cjs');

const root = path.resolve(__dirname, '../dist');
const basePath = normalizeBasePath(process.env.BASE_PATH || '/');
const port = Number(process.env.PORT || 4173);
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function resolveRequest(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  } catch {
    return { status: 400, file: null };
  }
  if (basePath !== '/' && pathname === basePath.slice(0, -1)) return { redirect: `${basePath}${new URL(requestUrl, 'http://localhost').search}` };
  if (!pathname.startsWith(basePath)) return { status: 404, file: path.join(root, '404.html') };

  let relative = pathname.slice(basePath.length).replace(/^\/+/, '');
  if (!relative) relative = 'index.html';
  if (relative.endsWith('/')) relative += 'index.html';
  let candidate = path.resolve(root, relative);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return { status: 400, file: null };

  if (!path.extname(candidate)) {
    if (fs.existsSync(`${candidate}/index.html`)) return { redirect: `${pathname.replace(/\/$/, '')}/${new URL(requestUrl, 'http://localhost').search}` };
    candidate = path.join(candidate, 'index.html');
  }
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return { status: 200, file: candidate };
  return { status: 404, file: path.join(root, '404.html') };
}

const server = http.createServer((request, response) => {
  const resolved = resolveRequest(request.url || '/');
  if (resolved.redirect) {
    response.writeHead(308, { Location: resolved.redirect });
    response.end();
    return;
  }
  if (!resolved.file || !fs.existsSync(resolved.file)) {
    response.writeHead(resolved.status || 404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(resolved.status === 400 ? 'Bad request' : 'Not found');
    return;
  }
  const status = resolved.file.endsWith(`${path.sep}404.html`) ? 404 : (resolved.status || 200);
  response.writeHead(status, { 'Content-Type': contentTypes[path.extname(resolved.file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(resolved.file).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  const displayPath = basePath === '/' ? '/' : basePath;
  process.stdout.write(`Static preview: http://localhost:${port}${displayPath} (no SPA fallback)\n`);
});
