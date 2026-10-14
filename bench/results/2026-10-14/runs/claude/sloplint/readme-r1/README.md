# tally-words

`tally` counts word frequency across `.txt` and `.md` files and prints the most common words. It reads files and directories (recursively), has no dependencies, and needs Node.js 20 or later.

```sh
npm install -g .
tally --top 3 notes/
```

```
the   4
and   2
bird  1

1 files, 7 distinct words
```

## Usage

```
tally [options] <file|dir>...
```

| Option | Meaning | Default |
| --- | --- | --- |
| `--top <n>` | Show the n most frequent words | 10 |
| `--min-length <n>` | Ignore words shorter than n characters | 1 |
| `--ignore <word>` | Skip a word; repeat for several | none |
| `--json` | Print `{"files", "words", "top"}` as JSON | off |
| `-h`, `--help` | Show help and exit 0 | |

Running `tally` with no paths prints the help text and exits with code 2.

Directories are walked recursively, and only files ending in `.txt` or `.md` (any case) are read. Explicitly named files with other extensions are skipped too.

## How words are counted

- Text is lowercased, so `The` and `the` are the same word.
- A word is a run of letters, digits and apostrophes, in any script. `cat's` is one word; leading and trailing apostrophes are stripped.
- Ties are broken alphabetically.
- Counts are merged across all files; `words` in the output is the number of distinct words, not the total.

## JSON output

```sh
tally --top 2 --min-length 4 --json notes/
```

```json
{
  "files": 1,
  "words": 2,
  "top": {
    "bird": 1,
    "cat's": 1
  }
}
```

`words` counts distinct words after `--min-length` and `--ignore` are applied, and `top` is an object of word to count.

## Library use

`src/count.js` exports the counting functions as an ES module:

```js
import { countWords, merge, topWords } from './src/count.js';

const counts = countWords('the cat and the dog', { minLength: 3, ignore: ['and'] });
topWords(counts, 2); // [['the', 2], ['cat', 1]]
```

- `countWords(text, { minLength, ignore })` returns a `Map` of word to count.
- `merge(into, from)` adds the counts in `from` to `into` and returns `into`.
- `topWords(counts, n)` returns the `n` highest `[word, count]` pairs.

## License

MIT
