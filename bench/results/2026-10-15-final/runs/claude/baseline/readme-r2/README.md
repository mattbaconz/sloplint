# tally-words

Count word frequency across text files from the command line.

Requires Node.js 20 or later. No dependencies.

## Usage

```sh
node bin/tally.js [options] <file|dir>...
```

Or, once installed (`npm install -g .` or `npm link`), run `tally`.

Directories are searched recursively. Only `.txt` and `.md` files are read; anything else is skipped.

### Options

| Option | Description | Default |
| --- | --- | --- |
| `--top <n>` | Show the n most frequent words | `10` |
| `--min-length <n>` | Ignore words shorter than n characters | `1` |
| `--ignore <word>` | Skip a word; repeat for several | none |
| `--json` | Print `{"files", "words", "top"}` as JSON | off |
| `-h`, `--help` | Show help | |

Running with no paths prints the usage text and exits with status 2.

### Example

```sh
tally --top 3 --min-length 4 --ignore that notes/
```

```
this  42
with  31
have  27

12 files, 980 distinct words
```

With `--json`:

```json
{
  "files": 12,
  "words": 980,
  "top": { "this": 42, "with": 31, "have": 27 }
}
```

## How words are counted

- Text is lowercased, so `The` and `the` are the same word.
- A word is a run of letters, digits and apostrophes (Unicode-aware). Leading and trailing apostrophes are trimmed, so `don't` stays whole and `'quoted'` becomes `quoted`.
- Ties are sorted alphabetically.
- `--ignore` matching is case-insensitive.

## Library use

`src/count.js` exports the counting functions:

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
