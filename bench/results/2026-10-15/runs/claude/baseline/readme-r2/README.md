# tally-words

Count word frequency across text files from the command line.

`tally` reads `.txt` and `.md` files (or whole directories of them), counts words, and prints the most frequent ones.

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
| `--ignore <word>` | Skip a word; repeat for several | none |
| `--json` | Print `{"files", "words", "top"}` as JSON | off |
| `-h`, `--help` | Show help | |

Running `tally` with no paths prints the usage text and exits with status 2.

### Examples

Top 10 words in a single file:

```sh
tally notes.txt
```

Top 5 words across a directory, skipping short words and a few common ones:

```sh
tally --top 5 --min-length 4 --ignore this --ignore that docs/
```

Machine-readable output:

```sh
tally --json docs/ README.md
```

```json
{
  "files": 3,
  "words": 412,
  "top": { "word": 21, "another": 17 }
}
```

### Output

Plain output is one `word  count` pair per line, aligned, followed by a summary line:

```
the   42
and   31

2 files, 118 distinct words
```

## How words are counted

- Text is lowercased, so `The` and `the` are the same word.
- A word is a run of letters, digits and apostrophes (Unicode-aware). Leading and trailing apostrophes are stripped, so `don't` stays whole but `'quoted'` becomes `quoted`.
- Ties are sorted alphabetically.
- Directories are searched recursively. Only files ending in `.txt` or `.md` (case-insensitive) are read; anything else is skipped, including files named explicitly on the command line.
- Counts are combined across all files.

## Library use

The counting logic is in `src/count.js` as plain ES module functions:

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
