// The page fetcher behind the site's "Score a page" box: it must refuse what it should and
// never forward the visitor's cookies.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { checkTarget, robotsAllows, stylesheetLinks, RateLimiter } from '../worker/fetch-page.mjs';

test('checkTarget accepts public http(s) URLs and refuses everything else', () => {
  assert.equal(checkTarget('https://example.com/a?b=1').href, 'https://example.com/a?b=1');
  for (const bad of ['', 'example.com', 'ftp://example.com/', 'file:///etc/passwd', 'javascript:alert(1)', 'http://localhost:8080/', 'http://printer.local/', 'http://127.0.0.1/', 'http://0x7f.1/', 'http://[::1]/', 'https://user:pw@example.com/']) {
    assert.equal(typeof checkTarget(bad), 'string', bad);
  }
});

test('robotsAllows follows RFC 9309 group and longest-match rules', () => {
  const txt = 'User-agent: *\nDisallow: /private\nAllow: /private/ok\nDisallow: /*.json$\n\nUser-agent: badbot\nDisallow: /\n';
  assert.equal(robotsAllows(txt, '/'), true);
  assert.equal(robotsAllows(txt, '/private/x'), false);
  assert.equal(robotsAllows(txt, '/private/ok/x'), true);
  assert.equal(robotsAllows(txt, '/data.json'), false);
  assert.equal(robotsAllows(txt, '/data.json?x'), true);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /\n\nUser-agent: sloplint\nDisallow:\n', '/'), true);
  assert.equal(robotsAllows('User-agent: Sloplint\nUser-agent: other\nDisallow: /\n', '/x'), false);
  assert.equal(robotsAllows('', '/anything'), true);
});

test('stylesheetLinks reads rel=stylesheet links and skips alternates', () => {
  const html = `<link rel="preload" href="/a.css"><link href='/b.css?v=1&amp;x=2' rel="stylesheet"><link rel=stylesheet href=c.css><link rel="alternate stylesheet" href="/d.css"><LINK REL="Stylesheet" HREF="https://cdn.example.net/e.css">`;
  assert.deepEqual(stylesheetLinks(html, new URL('https://example.com/docs/')), [
    'https://example.com/b.css?v=1&x=2',
    'https://example.com/docs/c.css',
    'https://cdn.example.net/e.css',
  ]);
});

test('the rate limiter allows exactly 10 requests in any 60 seconds', () => {
  const limiter = new RateLimiter();
  const real = Date.now;
  let now = 1_000_000;
  Date.now = () => now;
  try {
    assert.deepEqual(Array.from({ length: 11 }, () => limiter.fetch().status), [...Array(10).fill(204), 429]);
    now += 59_999;
    assert.equal(limiter.fetch().status, 429);
    now += 1;
    assert.equal(limiter.fetch().status, 204);
  } finally {
    Date.now = real;
  }
});

// Runs the Worker against a fake network. `routes` maps URL to [status, body, headers].
async function call(target, routes, { origin = 'https://mattbaconz.github.io', limited = false } = {}) {
  const seen = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    seen.push({ url: String(url), headers: init.headers });
    const [status, body = '', headers = {}] = routes[String(url)] ?? [404];
    return new Response(status >= 300 && status < 400 ? null : body, { status, headers });
  };
  try {
    const request = new Request(`https://fetcher.test/?url=${encodeURIComponent(target)}`, { headers: { origin, cookie: 'session=secret', authorization: 'Bearer x' } });
    const limiter = new RateLimiter();
    if (limited) limiter.hits = Array(10).fill(Date.now());
    const env = { ALLOWED_ORIGINS: 'https://mattbaconz.github.io', LIMITER: { idFromName: (name) => name, get: () => limiter } };
    const res = await worker.fetch(request, env);
    return { status: res.status, body: await res.json(), cors: res.headers.get('access-control-allow-origin'), seen };
  } finally {
    globalThis.fetch = real;
  }
}

const HTML = { 'content-type': 'text/html; charset=utf-8' };
const CSS = { 'content-type': 'text/css' };

test('the Worker returns the page and its same-origin stylesheets without forwarding cookies', async () => {
  const r = await call('https://example.com/', {
    'https://example.com/robots.txt': [200, 'User-agent: *\nDisallow: /secret.css\n'],
    'https://example.com/': [200, '<link rel="stylesheet" href="/site.css"><link rel="stylesheet" href="/secret.css"><link rel="stylesheet" href="https://cdn.example.net/x.css">', HTML],
    'https://example.com/site.css': [200, 'a { color: red }', CSS],
  });
  assert.equal(r.status, 200);
  assert.equal(r.cors, 'https://mattbaconz.github.io');
  assert.equal(r.body.url, 'https://example.com/');
  assert.deepEqual(r.body.stylesheets, [{ url: 'https://example.com/site.css', css: 'a { color: red }', truncated: false }]);
  assert.deepEqual(r.body.skipped.map((s) => s.url), ['https://cdn.example.net/x.css', 'https://example.com/secret.css']);
  assert.ok(!r.seen.some((s) => s.url.includes('secret.css') || s.url.includes('cdn.example.net')));
  for (const { headers } of r.seen) assert.deepEqual(Object.keys(headers).sort(), ['accept', 'user-agent']);
});

test('the Worker refuses pages robots.txt disallows, before fetching them', async () => {
  const r = await call('https://example.com/private', {
    'https://example.com/robots.txt': [200, 'User-agent: sloplint\nDisallow: /private\n'],
    'https://example.com/private': [200, '<p>hi</p>', HTML],
  });
  assert.equal(r.status, 403);
  assert.match(r.body.error, /robots\.txt/);
  assert.deepEqual(r.seen.map((s) => s.url), ['https://example.com/robots.txt']);
});

test('the Worker treats an unreachable robots.txt as disallow and a missing one as allow', async () => {
  const down = await call('https://example.com/', { 'https://example.com/robots.txt': [503], 'https://example.com/': [200, '<p>hi</p>', HTML] });
  assert.equal(down.status, 403);
  const missing = await call('https://example.com/', { 'https://example.com/': [200, '<p>hi</p>', HTML] });
  assert.equal(missing.status, 200);
  assert.equal(missing.body.html, '<p>hi</p>');
});

test('the Worker re-checks every redirect hop', async () => {
  const r = await call('https://example.com/', { 'https://example.com/': [302, '', { location: 'http://127.0.0.1/admin' }] });
  assert.equal(r.status, 400);
  assert.ok(!r.seen.some((s) => s.url.includes('127.0.0.1')));
});

test('the Worker caps the page size, refuses non-HTML, other origins and rate-limited callers', async () => {
  const big = await call('https://example.com/', { 'https://example.com/': [200, 'x'.repeat(2_100_000), HTML] });
  assert.equal(big.body.truncated, true);
  assert.equal(big.body.html.length, 2_000_000);

  assert.equal((await call('https://example.com/a.png', { 'https://example.com/a.png': [200, 'png', { 'content-type': 'image/png' }] })).status, 415);
  const foreign = await call('https://example.com/', {}, { origin: 'https://evil.example' });
  assert.equal(foreign.status, 403);
  assert.equal(foreign.cors, null);
  assert.equal(foreign.seen.length, 0);
  assert.equal((await call('https://example.com/', {}, { limited: true })).status, 429);
});
