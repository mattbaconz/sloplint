// Asks the Google Fonts CSS2 API for every curated family and weight set in src/design.mjs.
// Needs the network, so it runs on demand (npm run check:fonts), not in npm test.
import { FONT } from '../src/design.mjs';

const failed = [];
await Promise.all(
  Object.entries(FONT).map(async ([family, { w }]) => {
    const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${w.join(';')}&display=swap`;
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 Chrome/130' }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) failed.push(`${family} ${w.join(';')}: HTTP ${res.status}`);
  }),
);
console.log(`${Object.keys(FONT).length} families checked, ${failed.length} failed${failed.length ? `:\n${failed.join('\n')}` : ''}`);
process.exitCode = failed.length ? 1 : 0;
