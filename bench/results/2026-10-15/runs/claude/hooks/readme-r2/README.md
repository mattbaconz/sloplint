# tally-words

Count word frequency across text files. Requires Node.js 20 or later.

## Usage

```
tally [options] <file|dir>...
```

Directories are searched recursively. Only `.txt` and `.md` files are read; other files are skipped.

| Option | Description | Default |
| --- | --- | --- |
| `--top <n>` | Show the n most frequent words | `10` |
| `--min-length <n>` | Ignore words shorter than n characters | `1` |
| `--ignore <word>` | Skip a word; repeat for several | none |
| `--json` | Print `{"files", "words", "top"}` as JSON | off |
| `-h`, `--help` | Show help | |

Running `tally` with no paths prints the usage text and exits with code 2.

### Example

```
$ tally --top 3 --min-length 4 notes/
that  42
with  31
from  27

12 files, 1840 distinct words
```

With `--json`:

```json
{
  "files": 12,
  "words": 1840,
  "top": { "that": 42, "with": 31, "from": 27 }
}
```

## How words are counted

- Text is lowercased, so `The` and `the` count as one word.
- A word is a run of letters, digits and apostrophes (Unicode aware). Leading and trailing apostrophes are trimmed.
- Ties in the ranking are broken alphabetically.

## Library use

The counting functions are in `src/count.js` and are ES module exports:

```js
import { countWords, merge, topWords } from './src/count.js';

const counts = countWords('the cat and the hat', { minLength: 3, ignore: ['and'] });
topWords(counts, 2); // [['the', 2], ['cat', 1]]
```

- `countWords(text, { minLength = 1, ignore = [] })` returns a `Map` of word to count.
- `merge(into, from)` adds the counts in `from` to `into` and returns `into`.
- `topWords(counts, n)` returns the n highest `[word, count]` pairs.

## License

MIT
