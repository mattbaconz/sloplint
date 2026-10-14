#!/usr/bin/env node
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { countWords, merge, topWords } from '../src/count.js';

const USAGE = `Usage: tally [options] <file|dir>...

Options:
  --top <n>           Show the n most frequent words (default 10)
  --min-length <n>    Ignore words shorter than n characters (default 1)
  --ignore <word>     Skip a word; repeat for several
  --json              Print {"files", "words", "top"} as JSON
  -h, --help          Show this help`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    top: { type: 'string', default: '10' },
    'min-length': { type: 'string', default: '1' },
    ignore: { type: 'string', multiple: true, default: [] },
    json: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help || positionals.length === 0) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 2);
}

const files = positionals.flatMap(function expand(path) {
  return statSync(path).isDirectory() ? readdirSync(path).flatMap((name) => expand(join(path, name))) : [path];
}).filter((path) => /\.(txt|md)$/i.test(path));

const options = { minLength: Number(values['min-length']), ignore: values.ignore };
const counts = files.reduce((all, path) => merge(all, countWords(readFileSync(path, 'utf8'), options)), new Map());
const top = topWords(counts, Number(values.top));

if (values.json) {
  console.log(JSON.stringify({ files: files.length, words: counts.size, top: Object.fromEntries(top) }, null, 2));
} else {
  const width = Math.max(0, ...top.map(([word]) => word.length));
  for (const [word, n] of top) console.log(`${word.padEnd(width)}  ${n}`);
  console.log(`\n${files.length} files, ${counts.size} distinct words`);
}
