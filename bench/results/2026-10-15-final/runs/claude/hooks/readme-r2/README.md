# tally-words

Count word frequency across text files from the command line.

Requires Node.js 20 or later. No runtime dependencies.

## Usage

```sh
node bin/tally.js [options] <file|dir>...
```

Or, if installed so the `tally` binary is on your path:

```sh
tally [options] <file|dir>...
```

Directories are searched recursively. Only files ending in `.txt` or `.md` (case-insensitive) are read; everything else is skipped.

### Options

| Option | Description | Default |
| --- | --- | --- |
| `--top <n>` | Show the n most frequent words | `10` |
| `--min-length <n>` | Ignore words shorter than n characters | `1` |
| `--ignore <word>` | Skip a word; repeat the flag for several | none |
| `--json` | Print `{"files", "words", "top"}` as JSON | off |
| `-h`, `--help` | Show help and exit | |

Running `tally` with no paths prints the help text and exits with status 2.

### Example

```sh
tally --top 3 --min-length 4 --ignore this notes/ draft.md
```

Output:

```
word   12
other   7
more    5

4 files, 218 distinct words
```

With `--json`:

```json
{
  "files": 4,
  "words": 218,
  "top": { "word": 12, "other": 7, "more": 5 }
}
```

`files` is the number of files read, `words` is the number of distinct words, and `top` maps each of the most frequent words to its count.

## How words are counted

- Text is lowercased, so `The` and `the` count as one word.
- A word is a run of letters, digits and apostrophes in any script, so `don't` is one word.
- Apostrophes at the start or end of a word are trimmed.
- Words tied on count are ordered alphabetically.

## Library use

The counting logic is exported from `src/count.js`:

```js
import { countWords, merge, topWords } from './src/count.js';

const counts = countWords('the cat and the hat', { minLength: 3, ignore: ['and'] });
topWords(counts, 2); // [['the', 2], ['cat', 1]]
```

- `countWords(text, { minLength = 1, ignore = [] })` returns a `Map` of word to count.
- `merge(into, from)` adds the counts in `from` to `into` and returns `into`.
- `topWords(counts, n)` returns the `n` highest `[word, count]` pairs.

## License

MIT
