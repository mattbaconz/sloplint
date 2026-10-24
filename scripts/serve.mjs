// Zero-dependency static server laid out like the deployed site: site/ at the root with clean URLs
// (/score serves site/score.html), and src, examples, presets and rules beside it for ../src imports.
// Usage: node scripts/serve.mjs [port]  ->  http://localhost:4173/

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SITE = join(ROOT, 'site');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

export function serve(port = 4173) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const path = decodeURIComponent(url.pathname);
    const top = path.split('/')[1];
    const base = ['src', 'examples', 'presets', 'rules'].includes(top) ? ROOT : SITE;
    let file = normalize(join(base, path));
    if (file !== base && !file.startsWith(base + sep)) {
      res.writeHead(403).end('Path is outside the site.');
      return;
    }
    try {
      if (path.endsWith('/')) file = join(file, 'index.html');
      else if (!extname(file)) file += '.html';
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end(`Not found: ${url.pathname}`);
    }
  });
  return new Promise((done) => server.listen(port, () => done(server)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await serve(Number(process.argv[2]) || 4173);
  console.log(`sloplint docs: http://localhost:${server.address().port}/`);
}
