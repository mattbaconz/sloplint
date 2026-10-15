# tally-words

Count word frequency across text files. `tally` reads `.txt` and `.md` files, merges the counts, and prints the most frequent words.

## Requirements

Node.js 20 or later. There are no runtime dependencies.

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

Pass any mix of files and directories. Directories are searched recursively, and only files ending in `.txt` or `.md` (any case) are counted. Other files are skipped, even when named explicitly.

| Option | Description | Default |
| --- | --- | --- |
| `--top <n>` | Show the n most frequent words | `10` |
| `--min-length <n>` | Ignore words shorter than n characters | `1` |
| `--ignore <word>` | Skip a word; repeat for several | none |
| `--json` | Print `{"files", "words", "top"}` as JSON | off |
| `-h`, `--help` | Show help | |

Running `tally` with no paths prints the help text and exits with status 2.

### Example

```sh
tally --top 3 --min-length 4 --ignore that notes/
```

```
word   12
other  9
text   7

5 files, 218 distinct words
```

The last line reports the number of files read and the number of distinct words found, before `--top` is applied.

With `--json`:

```json
{
  "files": 5,
  "words": 218,
  "top": {
    "word": 12,
    "other": 9,
    "text": 7
  }
}
```

## How words are counted

- Text is lowercased, so `The` and `the` are the same word.
- A word is a run of Unicode letters, digits and apostrophes. Leading and trailing apostrophes are trimmed, so `don't` stays whole and `'quoted'` becomes `quoted`.
- `--min-length` and `--ignore` are applied after trimming. `--ignore` matching is case-insensitive.
- Words with equal counts are listed alphabetically.

## Library use

The counting functions are in `src/count.js` as ES modules:

```js
import { countWords, merge, topWords } from './src/count.js';

const counts = countWords('the cat and the hat', { minLength: 3, ignore: ['and'] });
topWords(counts, 2); // [['the', 2], ['cat', 1]]
```

| Function | Returns |
| --- | --- |
| `countWords(text, { minLength, ignore })` | `Map` of word to count |
| `merge(into, from)` | `into`, with the counts from `from` added |
| `topWords(counts, n)` | The n highest `[word, count]` pairs, ties broken alphabetically |

## License

MIT
