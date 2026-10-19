// Cloudflare Worker behind the docs site's "Score a page" box. Browsers cannot read other
// sites' HTML (CORS), so this fetches a public page and its same-origin stylesheets and
// returns them as JSON. It only fetches: the site lints the result with the in-browser engine.
//
// Known limit: any client that sends an allowed Origin header gets the raw HTML of a public,
// robots-allowed page, so this is a (poor) fetch proxy. The caps below, the 10-a-minute
// rate limit per IP and the refusal of IP literals and local names keep that small. Linting
// here and returning findings only would close it, but the engine takes 200 to 500 ms of CPU
// on a typical 600 KB page and Workers Free allows 10 ms per request, so that needs Workers
// Paid and a redeploy on every rule change.
//
// GET /?url=https://example.com/  ->  { url, html, truncated, stylesheets: [{ url, css, truncated }], skipped }
//
// Local: npx wrangler dev --var ALLOWED_ORIGINS:http://localhost:4173

const AGENT = 'sloplint';
const USER_AGENT = 'sloplint/0.2 (+https://mattbaconz.github.io/sloplint/site/score.html)';
const MAX_HTML = 2_000_000;
const MAX_CSS = 1_000_000;
const MAX_ROBOTS = 500_000;
const MAX_SHEETS = 8;
const MAX_REDIRECTS = 5;
const DEADLINE_MS = 15_000;

class Refusal extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Returns the parsed URL, or the reason it is refused. Public pages have domain names, so
// IP literals and local names are refused outright instead of range-checking addresses.
export function checkTarget(raw) {
  if (!raw || !URL.canParse(raw)) return 'Enter a full URL, starting with https://.';
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'Only http and https URLs can be scored.';
  if (url.username || url.password) return 'URLs with credentials in them are refused.';
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') || /\.(localhost|local|internal|lan|home\.arpa)$/.test(host)) return 'Only public hosts can be scored.';
  if (host.startsWith('[') || /^[\d.]+$/.test(host)) return 'Use the domain name, not an IP address.';
  return url;
}

// RFC 9309: the most specific group for our token, else `*`; the longest matching rule wins,
// Allow wins a tie, and `*` and a trailing `$` work as in Google's and Bing's parsers.
export function robotsAllows(txt, path) {
  const groups = [];
  let group = null;
  let inAgents = false;
  for (const raw of txt.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z-]+)\s*:\s*(.*?)\s*$/.exec(raw.replace(/#.*/, ''));
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (key === 'user-agent') {
      if (!inAgents) groups.push((group = { agents: [], rules: [] }));
      group.agents.push(m[2].toLowerCase());
      inAgents = true;
    } else {
      inAgents = false;
      if (group && (key === 'allow' || key === 'disallow') && m[2]) group.rules.push({ allow: key === 'allow', path: m[2] });
    }
  }
  const mine = groups.filter((g) => g.agents.includes(AGENT));
  const rules = (mine.length ? mine : groups.filter((g) => g.agents.includes('*'))).flatMap((g) => g.rules);
  let best = null;
  for (const rule of rules) {
    if (!pathMatches(rule.path, path)) continue;
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow)) best = rule;
  }
  return !best || best.allow;
}

function pathMatches(pattern, path) {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern).split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`).test(path);
}

// <link rel="stylesheet" href> in document order, resolved against the page URL.
export function stylesheetLinks(html, base) {
  const out = [];
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const attr = (name) => new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)?.slice(1).find((v) => v != null);
    const rel = ` ${(attr('rel') ?? '').toLowerCase()} `;
    const href = attr('href')?.replace(/&amp;/g, '&');
    if (!rel.includes(' stylesheet ') || rel.includes(' alternate ') || !href || !URL.canParse(href, base)) continue;
    out.push(new URL(href, base).href);
  }
  return [...new Set(out)];
}

// Reads at most `max` bytes, so a huge or endless body cannot exhaust the Worker.
async function readCapped(res, max) {
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.byteLength > max) {
      chunks.push(value.subarray(0, max - size));
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    size += value.byteLength;
  }
  const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  // ponytail: decodes as UTF-8 only; honor the charset header if non-UTF-8 pages show up.
  return { text: new TextDecoder().decode(bytes), truncated };
}

// One fetcher per request: a shared deadline, a robots.txt cache per origin, and no headers
// from the visitor's request (no cookies, no auth), only our own user agent. Every hop of a
// redirect chain is re-checked against checkTarget and robots.txt before it is fetched.
function fetcher() {
  const signal = AbortSignal.timeout(DEADLINE_MS);
  const robots = new Map();

  async function hop(url, accept, obeyRobots) {
    for (let n = 0; n <= MAX_REDIRECTS; n++) {
      const checked = checkTarget(url.href);
      if (typeof checked === 'string') throw new Refusal(400, `Redirected to ${url.href}: ${checked}`);
      if (obeyRobots && !(await allowed(url))) throw new Refusal(403, `robots.txt on ${url.host} does not allow fetching ${url.pathname}.`);
      const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept }, redirect: 'manual', signal });
      const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
      if (!location) return { res, url };
      await res.body?.cancel();
      if (!URL.canParse(location, url)) throw new Refusal(502, `${url.host} sent a broken redirect.`);
      url = new URL(location, url);
    }
    throw new Refusal(502, `More than ${MAX_REDIRECTS} redirects.`);
  }

  async function allowed(url) {
    if (!robots.has(url.origin)) robots.set(url.origin, readRobots(new URL('/robots.txt', url)));
    const txt = await robots.get(url.origin);
    if (txt === null) throw new Refusal(403, `Could not read robots.txt on ${url.host}, so the page was not fetched.`);
    return robotsAllows(txt, url.pathname + url.search);
  }

  // RFC 9309 2.3.1.3-4: an unavailable robots.txt (4xx) allows everything; an unreachable
  // one (5xx, network error) means assume everything is disallowed.
  async function readRobots(url) {
    try {
      const { res } = await hop(url, 'text/plain', false);
      if (res.ok) return (await readCapped(res, MAX_ROBOTS)).text;
      await res.body?.cancel();
      return res.status >= 400 && res.status < 500 ? '' : null;
    } catch (error) {
      if (signal.aborted) throw error;
      return null;
    }
  }

  return async function get(url, accept, max) {
    const { res, url: final } = await hop(url, accept, true);
    if (!res.ok) {
      await res.body?.cancel();
      throw new Refusal(502, `${final.host} answered HTTP ${res.status}.`);
    }
    return { url: final, type: res.headers.get('content-type') ?? '', ...(await readCapped(res, max)) };
  };
}

async function scrape(target) {
  const get = fetcher();
  const page = await get(target, 'text/html,application/xhtml+xml', MAX_HTML);
  if (!/html/i.test(page.type)) throw new Refusal(415, `That URL is ${page.type || 'not labeled'}, not an HTML page.`);

  const links = stylesheetLinks(page.text, page.url);
  const sameOrigin = links.filter((href) => new URL(href).origin === page.url.origin);
  const skipped = links.filter((href) => !sameOrigin.includes(href)).map((url) => ({ url, reason: 'other origin' }));
  skipped.push(...sameOrigin.slice(MAX_SHEETS).map((url) => ({ url, reason: `over the ${MAX_SHEETS}-stylesheet limit` })));

  const sheets = await Promise.allSettled(sameOrigin.slice(0, MAX_SHEETS).map((href) => get(new URL(href), 'text/css', MAX_CSS)));
  const stylesheets = [];
  sheets.forEach((s, i) => {
    const url = sameOrigin[i];
    if (s.status === 'rejected') skipped.push({ url, reason: s.reason.message });
    else if (s.value.type && !/css/i.test(s.value.type)) skipped.push({ url, reason: `served as ${s.value.type}` });
    else stylesheets.push({ url: s.value.url.href, css: s.value.text, truncated: s.value.truncated });
  });
  return { url: page.url.href, html: page.text, truncated: page.truncated, stylesheets, skipped };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') ?? '';
    const allowedOrigins = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const cors = allowedOrigins.includes(origin) ? { 'access-control-allow-origin': origin, vary: 'origin' } : { vary: 'origin' };
    const reply = (status, body) => Response.json(body, { status, headers: { ...cors, 'cache-control': 'no-store' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'access-control-allow-methods': 'GET' } });
    if (request.method !== 'GET') return reply(405, { error: 'Use GET.' });
    // Not a security boundary (any client can send an Origin header), but it keeps other
    // sites from embedding this as a free proxy.
    if (!cors['access-control-allow-origin']) return reply(403, { error: 'This fetcher only serves the sloplint docs site.' });

    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
    if (!(await env.LIMITER.limit({ key: ip })).success) return reply(429, { error: 'Too many pages scored from your network. Wait a minute and try again.' });

    const target = checkTarget(new URL(request.url).searchParams.get('url'));
    if (typeof target === 'string') return reply(400, { error: target });

    try {
      return reply(200, await scrape(target));
    } catch (error) {
      if (error instanceof Refusal) return reply(error.status, { error: error.message });
      if (error.name === 'TimeoutError' || error.name === 'AbortError') return reply(504, { error: `${target.host} took longer than ${DEADLINE_MS / 1000} seconds.` });
      return reply(502, { error: `Could not reach ${target.host}: ${error.message}` });
    }
  },
};
