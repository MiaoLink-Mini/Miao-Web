/** Loopback preview server. Only published UI assets are exposed, never project files. */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, lstat, realpath } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const files = new Set(['/index.html', '/styles.css', '/app.js', '/src/scene.js',
  '/src/resource-scope.js', '/vendor/three-loader.js', '/vendor/THREE-LICENSE.txt']);
const types = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'], ['.txt', 'text/plain; charset=utf-8']
]);
function publicPath(name) {
  return files.has(name) || name.startsWith('/assets/') && ['.png', '.svg', '.jpg', '.jpeg', '.webp'].includes(path.posix.extname(name)) ||
    name.startsWith('/vendor/three/') && name.endsWith('.js');
}
export async function createPreviewServer(directory) {
  const root = await realpath(directory);
  return createServer(async (request, response) => {
    const reject = (status, message) => {
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store', ...(status === 405 ? { Allow: 'GET, HEAD' } : {}) });
      response.end(message);
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') return reject(405, 'Method not allowed');
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch { return reject(400, 'Malformed URL'); }
    if (/[\x00-\x1f\\]/.test(pathname) || pathname.split('/').some(p => p.startsWith('.') || p === 'node_modules')) return reject(403, 'Forbidden');
    if (pathname === '/') pathname = '/index.html';
    if (!publicPath(pathname)) return reject(403, 'Forbidden');
    let filename = root;
    try {
      // An allowed asset URL must not point to private files via a symlink,
      // including a symlink whose destination is still within the Web root.
      for (const part of pathname.split('/').filter(Boolean)) {
        filename = path.join(filename, part);
        if ((await lstat(filename)).isSymbolicLink()) return reject(403, 'Forbidden');
      }
      filename = await realpath(filename);
      if (!filename.startsWith(root + path.sep)) return reject(403, 'Forbidden');
      const info = await stat(filename);
      if (!info.isFile()) return reject(404, 'Not found');
      response.writeHead(200, {
        'Content-Type': types.get(path.extname(filename)) ?? 'application/octet-stream',
        'Content-Length': info.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer'
      });
      if (request.method === 'HEAD') return response.end();
      const stream = createReadStream(filename);
      stream.on('error', () => response.destroy());
      stream.pipe(response);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return reject(404, 'Not found');
      console.error(error.message); reject(500, 'Internal error');
    }
  });
}
async function main() {
  const port = Number(process.env.PORT ?? 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('PORT must be an integer between 1 and 65535.');
  const server = await createPreviewServer(fileURLToPath(new URL('../', import.meta.url)));
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`喵连 preview: http://127.0.0.1:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(error => { console.error(error.message); process.exitCode = 1; });
