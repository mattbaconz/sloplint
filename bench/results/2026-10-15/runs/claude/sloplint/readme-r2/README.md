# tally-words

Count word frequency across text files. Point it at files or directories and it prints the most common words.

## Requirements

Node.js 20 or later. There are no dependencies.

## Install

From a checkout of this repository:

```sh
npm link
```

This puts the `tally` command on your PATH. Without linking, run `node bin/tally.js` instead.

## Usage

```sh
tally [options] <file|dir>...
```

Directories are searched recursively. Only files ending in `.txt` or `.md` (any case) are read; everything else is skipped, including files you name explicitly.

```sh
tally notes/
tally --top 5 --min-length 4 README.md docs/
tally --ignore the --ignore and --json essays/
```

Default output is one word per line with its count, followed by a summary:

```
tally  12
words   9

2 files, 148 distinct words
```

### Options

| Option | Default | Description |
| --- | --- | --- |
| `--top <n>` | `10` | Show the n most frequent words. |
| `--min-length <n>` | `1` | Ignore words shorter than n characters. |
| `--ignore <word>` | none | Skip a word. Repeat the flag for several. Case-insensitive. |
| `--json` | off | Print JSON instead of the table. |
| `-h`, `--help` | off | Show usage and exit with status 0. |

Running `tally` with no paths prints the usage text and exits with status 2.

### JSON output

```json
{
  "files": 2,
  "words": 148,
  "top": { "tally": 12, "words": 9 }
}
```

`files` is the number of files read, `words` is the number of distinct words, and `top` maps each of the top words to its count.

## How words are counted

- Text is lowercased, so `Word` and `word` are the same entry.
- A word is a run of letters, digits and apostrophes, in any script.
- Apostrophes at the start or end of a word are trimmed, so `'quoted'` counts as `quoted` while `don't` stays whole.
- Ties are ordered alphabetically.

## Library use

The counting functions are in `src/count.js`:

```js
import { countWords, merge, topWords } from './src/count.js';

const counts = countWords('The cat and the hat', { ignore: ['and'] });
topWords(counts, 2); // [['the', 2], ['cat', 1]]
```

- `countWords(text, { minLength, ignore })` returns a `Map` of word to count.
- `merge(into, from)` adds the counts in `from` to `into` and returns `into`.
- `topWords(counts, n)` returns the n highest `[word, count]` pairs.

## License

MIT
