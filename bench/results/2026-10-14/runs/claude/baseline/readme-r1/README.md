# tally-words

Count word frequency across text files from the command line.

`tally` reads `.txt` and `.md` files (or whole directories of them), counts how often each word appears, and prints the most frequent ones.

## Requirements

Node.js 20 or later. There are no dependencies.

## Install

From the project directory:

```sh
npm install -g .
```

Or run it without installing:

```sh
node bin/tally.js <file|dir>...
```

## Usage

```
tally [options] <file|dir>...
```

| Option | Description | Default |
| --- | --- | --- |
| `--top <n>` | Show the `n` most frequent words | `10` |
| `--min-length <n>` | Ignore words shorter than `n` characters | `1` |
| `--ignore <word>` | Skip a word; repeat the flag to skip several | none |
| `--json` | Print `{"files", "words", "top"}` as JSON | off |
| `-h`, `--help` | Show help | |

Running `tally` with no paths prints the usage text and exits with status 2.

### Examples

Top 5 words in a single file:

```sh
tally --top 5 notes.md
```

Scan a directory, skipping short words and common filler:

```sh
tally --min-length 4 --ignore this --ignore that --ignore with docs/
```

Output looks like:

```
word   42
other  17

2 files, 311 distinct words
```

With `--json`:

```json
{
  "files": 2,
  "words": 311,
  "top": { "word": 42, "other": 17 }
}
```

## Behavior

- Directories are searched recursively. Only files ending in `.txt` or `.md` (case-insensitive) are read; this filter applies to files named directly too.
- Words are lowercased runs of letters, digits and apostrophes, so `Don't` and `don't` count as the same word. Leading and trailing apostrophes are stripped. Unicode letters and digits are supported.
- `--ignore` matching is case-insensitive.
- Counts are combined across all files. Ties are sorted alphabetically.

## Library use

The counting functions live in `src/count.js` as ES module exports:

```js
import { countWords, merge, topWords } from './src/count.js';

const counts = countWords('the cat and the hat', { minLength: 3, ignore: ['and'] });
topWords(counts, 2); // [['the', 2], ['cat', 1]]
```

- `countWords(text, { minLength, ignore })` returns a `Map` of word to count.
- `merge(into, from)` adds the counts in `from` to `into` and returns `into`.
- `topWords(counts, n)` returns the `n` highest `[word, count]` pairs.

## License

MIT
