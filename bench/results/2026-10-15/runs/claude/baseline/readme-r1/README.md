# tally-words

Count word frequency across text files.

`tally` reads `.txt` and `.md` files (or directories of them), counts how often each word appears, and prints the most frequent ones.

## Requirements

Node.js 20 or later.

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
| `--top <n>` | Show the n most frequent words | `10` |
| `--min-length <n>` | Ignore words shorter than n characters | `1` |
| `--ignore <word>` | Skip a word; repeat for several | none |
| `--json` | Print `{"files", "words", "top"}` as JSON | off |
| `-h`, `--help` | Show help | |

Running `tally` with no paths prints the help text and exits with status 2.

### Examples

Top 10 words in a file:

```sh
tally notes.txt
```

Top 20 words across a directory, skipping short words and a few fillers:

```sh
tally --top 20 --min-length 4 --ignore this --ignore that docs/
```

Machine-readable output:

```sh
tally --json docs/
```

```json
{
  "files": 3,
  "words": 412,
  "top": {
    "example": 17,
    "words": 12
  }
}
```

### Output

Plain output lists each word with its count, followed by a summary line:

```
the    42
and    30

2 files, 118 distinct words
```

## How words are counted

- Text is lowercased, so `The` and `the` are the same word.
- A word is a run of letters, digits and apostrophes (Unicode-aware). Leading and trailing apostrophes are stripped.
- Directories are searched recursively; only files ending in `.txt` or `.md` are read. Other files are ignored, but a file passed explicitly with another extension is also skipped.
- Ties are sorted alphabetically.

## Library use

The counting functions are in `src/count.js`:

```js
import { countWords, merge, topWords } from './src/count.js';

const counts = countWords('the cat and the hat', { minLength: 2, ignore: ['and'] });
topWords(counts, 3); // [['the', 2], ['cat', 1], ['hat', 1]]
```

- `countWords(text, { minLength, ignore })` returns a `Map` of word to count.
- `merge(into, from)` adds the counts in `from` to `into` and returns `into`.
- `topWords(counts, n)` returns the `n` highest `[word, count]` pairs.

## License

MIT
