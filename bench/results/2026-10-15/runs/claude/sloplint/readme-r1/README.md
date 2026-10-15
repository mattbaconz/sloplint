# tally-words

Count word frequency across text files. Pass files or directories; `tally` reads every `.txt` and `.md` file it finds and prints the most frequent words.

## Requirements

Node.js 20 or later. There are no runtime dependencies.

## Install

From a checkout of this repository:

```bash
npm install -g .
```

Or run it without installing:

```bash
node bin/tally.js notes/
```

## Usage

```bash
tally [options] <file|dir>...
```

Directories are searched recursively. Files that do not end in `.txt` or `.md` (case-insensitive) are skipped.

```bash
# Top 10 words in one file
tally essay.txt

# Top 25 words across a directory, ignoring short words and two stop words
tally --top 25 --min-length 4 --ignore the --ignore that docs/

# Machine-readable output
tally --json docs/ notes.md
```

### Options

| Option | Default | Description |
| --- | --- | --- |
| `--top <n>` | `10` | Show the `n` most frequent words. |
| `--min-length <n>` | `1` | Ignore words shorter than `n` characters. |
| `--ignore <word>` | none | Skip a word. Repeat the flag for several words. Matching is case-insensitive. |
| `--json` | off | Print JSON instead of a table. |
| `-h`, `--help` | | Show usage and exit with status 0. |

Running `tally` with no paths prints the usage text and exits with status 2.

### Output

The default output is one `word  count` row per word, followed by a summary line:

```text
the    42
and    31
tally  17

3 files, 218 distinct words
```

With `--json`, the output has this shape:

```json
{
  "files": 3,
  "words": 218,
  "top": { "the": 42, "and": 31, "tally": 17 }
}
```

`files` is the number of files read, `words` is the number of distinct words, and `top` maps each of the top words to its count, highest first.

## How words are counted

- Text is lowercased, so `Tally` and `tally` count as one word.
- A word is a run of letters, digits and apostrophes in any script. Hyphens and other punctuation split words.
- Apostrophes at the start or end of a word are trimmed, so `'tally'` counts as `tally` while `don't` stays intact.
- Ties are ordered alphabetically.

## Use as a library

`src/count.js` exports three functions:

```js
import { countWords, merge, topWords } from './src/count.js';

const counts = countWords('The cat and the hat', { minLength: 3, ignore: ['and'] });
topWords(counts, 2); // [['the', 2], ['cat', 1]]
```

- `countWords(text, { minLength, ignore })` returns a `Map` of word to count.
- `merge(into, from)` adds the counts in `from` to `into` and returns `into`.
- `topWords(counts, n)` returns the `n` highest `[word, count]` pairs.

## License

MIT
