# tally-words

Count word frequency across text files. `tally` reads every `.txt` and `.md` file under the paths you give it, merges the counts, and prints the most frequent words. It has no dependencies and needs Node 20 or later.

```sh
$ tally --top 3 --min-length 4 notes/
that  42
with  31
from  27

12 files, 1840 distinct words
```

## Install

```sh
npm install -g tally-words
```

Or run it from a checkout:

```sh
node bin/tally.js <file|dir>...
```

## Usage

```
tally [options] <file|dir>...
```

Directories are searched recursively. Files that don't end in `.txt` or `.md` (case-insensitive) are skipped, including files you name directly.

| Option | Default | Effect |
| --- | --- | --- |
| `--top <n>` | `10` | Show the n most frequent words |
| `--min-length <n>` | `1` | Ignore words shorter than n characters |
| `--ignore <word>` | none | Skip a word; repeat for several |
| `--json` | off | Print `{"files", "words", "top"}` as JSON |
| `-h`, `--help` | | Show usage |

Exit status is `0` on success and `2` when no path is given.

### Examples

Skip common words:

```sh
tally --ignore the --ignore and --ignore of docs/ README.md
```

Machine-readable output:

```sh
tally --json --top 2 docs/
```

```json
{
  "files": 4,
  "words": 512,
  "top": {
    "cache": 19,
    "queue": 14
  }
}
```

`files` is the number of files read and `words` is the number of distinct words found.

## How words are counted

- Text is lowercased, so `Tally` and `tally` count together.
- A word is a run of letters, digits and apostrophes in any script. Leading and trailing apostrophes are trimmed, so `don't` stays whole and `'quoted'` becomes `quoted`.
- Ties in frequency are ordered alphabetically.

## Library use

The counting functions are in `src/count.js`:

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
