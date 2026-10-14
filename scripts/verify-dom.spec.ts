// Rendered-page verifier: the checks sloplint's static rules cannot see from source alone.
// It reads computed styles, layout and visible text of a live page.
//
//   npm run verify:dom                                   # the docs site, served locally
//   SLOPLINT_URL=http://localhost:3000 npm run verify:dom  # any running app

import { test, expect, type Page } from '@playwright/test';

const TARGET = process.env.SLOPLINT_URL ?? 'http://localhost:4173/site/';

type Audit = {
  transitionAll: string[];
  neon: string[];
  gradientText: string[];
  radius: string[];
  numbers: string[];
  copy: string[];
  labels: string[];
};

// Runs inside the page, so it must be self-contained.
function audit(): Audit {
  const label = (el: Element) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };
  const shown = (el: Element) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0;
  };
  const SKIP = 'pre, code, kbd, samp, textarea, script, style, svg, iframe, [aria-hidden="true"]';

  // Neon purple: hue 235-320 with real saturation, in sRGB or OKLCH.
  const neonIn = (value: string) => {
    for (const m of value.matchAll(/rgba?\(([^)]+)\)|oklch\(([^)]+)\)/g)) {
      if (m[1]) {
        const [r, g, b] = m[1].split(/[\s,/]+/).slice(0, 3).map((n) => Number(n) / 255);
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (max + min) / 2;
        const d = max - min;
        if (!d) continue;
        const s = d / (1 - Math.abs(2 * l - 1));
        let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h = (h * 60 + 360) % 360;
        if (h >= 235 && h <= 320 && s >= 0.45 && l >= 0.3 && l <= 0.8) return true;
      } else {
        const [, c, h] = m[2].split(/[\s/]+/).map(parseFloat);
        if (c >= 0.1 && h >= 270 && h <= 335) return true;
      }
    }
    return false;
  };

  const out: Audit = { transitionAll: [], neon: [], gradientText: [], radius: [], numbers: [], copy: [], labels: [] };
  const NUMBER = /^[-+−]?[$€£¥]?\s?\d[\d,.]*\s?(%|[kmb]|ms|x|db)?$/i;

  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el);
    const durations = s.transitionDuration.split(',').map(parseFloat);
    if (s.transitionProperty.split(',').some((p, i) => p.trim() === 'all' && durations[i % durations.length] > 0)) out.transitionAll.push(label(el));

    if (/gradient\(/.test(s.backgroundImage) && neonIn(s.backgroundImage)) out.neon.push(label(el));
    if (s.boxShadow !== 'none' && neonIn(s.boxShadow) && /\s(1[6-9]|[2-9]\d)px/.test(s.boxShadow)) out.neon.push(`${label(el)} (glow)`);
    if (s.backgroundClip === 'text' || s.getPropertyValue('-webkit-background-clip') === 'text') out.gradientText.push(label(el));

    const parent = el.parentElement;
    if (parent && shown(el) && !s.borderTopLeftRadius.endsWith('%')) {
      const ps = getComputedStyle(parent);
      const outer = parseFloat(ps.borderTopLeftRadius);
      const inner = parseFloat(s.borderTopLeftRadius);
      const a = parent.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      const gap = Math.min(b.left - a.left, b.top - a.top);
      const ideal = Math.max(0, outer - gap);
      if (!ps.borderTopLeftRadius.endsWith('%') && outer > 0 && inner > 0 && inner < 99 && gap >= 0 && gap < outer && inner > ideal + 2) {
        out.radius.push(`${label(el)} radius ${inner}px inside ${outer}px with ${gap.toFixed(0)}px gap (concentric: ${ideal.toFixed(0)}px)`);
      }
    }

    if (shown(el) && !el.closest(SKIP) && !/mono/i.test(s.fontFamily)) {
      const own = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim();
      const tabular = s.fontVariantNumeric.includes('tabular-nums') || /tnum/.test(s.fontFeatureSettings);
      if (NUMBER.test(own) && /\d.*\d/.test(own) && !tabular) out.numbers.push(`${label(el)} "${own}"`);
    }
  }

  // Visible copy. Quoted text is a mention ("Oops" in an explanation), not a use.
  const BUZZ = /\b(seamless(ly)?|supercharg\w*|unleash\w*|next[- ]gen\w*|delv(e|es|ed|ing)|revolutioni[sz]\w*|game[- ]chang\w*|cutting[- ]edge|state[- ]of[- ]the[- ]art|effortless(ly)?|empower\w*|world[- ]class|best[- ]in[- ]class|unparalleled)\b/i;
  const DEAD = /\b(an?\s+(unexpected|unknown)\s+error\s+(has\s+)?occurred|something\s+went\s+wrong|oops)\b/i;
  const FILLER = /\b(lorem ipsum|john doe|jane doe|acme (corp|inc))\b/i;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const host = node.parentElement;
    if (!host || host.closest(SKIP) || !shown(host)) continue;
    const text = (node.textContent ?? '').replace(/"[^"]*"|“[^”]*”|'[^']*'/g, ' ');
    for (const re of [BUZZ, DEAD, FILLER]) {
      const m = re.exec(text);
      if (m) out.copy.push(`${label(host)}: "${m[0]}"`);
    }
  }

  const VAGUE = /^(submit|ok|okay|click here|here|go|yes|no|learn more|read more|more)$/i;
  for (const el of document.querySelectorAll('button, a[href], [role="button"], input[type="submit"], input[type="button"]')) {
    if (!shown(el)) continue;
    const name = (el.getAttribute('aria-label') ?? (el as HTMLInputElement).value ?? '') || (el as HTMLElement).innerText;
    if (VAGUE.test(name.trim())) out.labels.push(`${label(el)} "${name.trim()}"`);
  }
  return out;
}

async function open(page: Page) {
  await page.goto(TARGET);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
}

function expectClean(result: Audit, context = '') {
  expect.soft(result.transitionAll, `UI-007 transition: all ${context}`).toEqual([]);
  expect.soft(result.neon, `UI-001 purple gradient or glow ${context}`).toEqual([]);
  expect.soft(result.gradientText, `UI-009 gradient text ${context}`).toEqual([]);
  expect.soft(result.radius, `UI-006 non-concentric radius ${context}`).toEqual([]);
  expect.soft(result.numbers, `UI-005 proportional digits ${context}`).toEqual([]);
  expect.soft(result.copy, `COPY-001/002/004 visible copy ${context}`).toEqual([]);
  expect.soft(result.labels, `COPY-003 vague labels ${context}`).toEqual([]);
}

test('computed styles and visible copy are free of slop', async ({ page }) => {
  await open(page);
  expectClean(await page.evaluate(audit));
});

test('UI-008: cumulative layout shift stays under 0.1', async ({ page }) => {
  await open(page);
  const cls = await page.evaluate(
    () =>
      new Promise<number>((done) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!entry.hadRecentInput) total += entry.value;
        }).observe({ type: 'layout-shift', buffered: true });
        requestAnimationFrame(() => requestAnimationFrame(() => done(total)));
      }),
  );
  expect(cls).toBeLessThan(0.1);
});

test('no horizontal overflow at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(375);
});

test('every preset passes the audit; screenshots are attached', async ({ page }, info) => {
  await open(page);
  const presets = await page.locator('input[name="preset"]').evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value));
  for (const name of presets.length ? presets : ['page']) {
    if (presets.length) {
      await page.locator(`input[name="preset"][value="${name}"]`).check();
      await expect(page.locator('html')).toHaveAttribute('data-preset', name);
      await page.evaluate(() => document.fonts.ready);
    }
    expectClean(await page.evaluate(audit), `(${name})`);
    for (const width of [1280, 375]) {
      await page.setViewportSize({ width, height: 800 });
      const path = info.outputPath(`${name}-${width}.png`);
      await page.screenshot({ path, fullPage: true });
      await info.attach(`${name} at ${width}px`, { path, contentType: 'image/png' });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
  }
});
