// The benchmark's mutation check is only fair if every seeded bug is catchable.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

test('the reference suite passes on the seed and kills all 16 mutants', () => {
  const r = spawnSync(process.execPath, ['bench/score.mjs', '--self-test'], { cwd: ROOT, encoding: 'utf8', timeout: 120_000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /passes, 16\/16 mutants killed/);
});
