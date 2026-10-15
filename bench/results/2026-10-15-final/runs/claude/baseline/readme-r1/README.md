# tally-words

Count word frequency across text files. Point it at files or directories and it prints the most frequent words.

Requires Node.js 20 or later. No dependencies.

## Usage

```
tally [options] <file|dir>...
```

Directories are searched recursively, and only `.txt` and `.md` files are read (case-insensitive). Other files are skipped.

| Option | Description | Default |
| --- | --- | --- |
| `--top <n>` | Show the n most frequent words | `10` |
| `--min-length <n>` | Ignore words shorter than n characters | `1` |
| `--ignore <word>` | Skip a word; repeat for several | none |
| `--json` | Print `{"files", "words", "top"}` as JSON | off |
| `-h`, `--help` | Show help | |

Running with no paths prints the usage text and exits with status 2.

### Examples

```
tally notes/
tally --top 5 --min-length 4 README.md docs/
tally --ignore the --ignore and --json essays/
```

Default output lists each word with its count, then a summary line:

```
the    42
and    31
...

12 files, 804 distinct words
```

With `--json`, `files` is the number of files read, `words` the number of distinct words, and `top` an object mapping each word to its count.

## How words are counted

- Text is lowercased, so `The` and `the` are the same word.
- A word is a run of letters, digits and apostrophes (Unicode-aware). Leading and trailing apostrophes are trimmed, so `don't` is one word and `'quoted'` becomes `quoted`.
- Ties in count are sorted alphabetically.
- `--ignore` matches case-insensitively.

## Library use

The counting functions are in `src/count.js` as ES module exports:

```js
import { countWords, merge, topWords } from './src/count.js';

const counts = countWords('the cat and the hat', { minLength: 3, ignore: ['and'] });
topWords(counts, 2); // [['the', 2], ['cat', 1]]
```

- `countWords(text, { minLength, ignore })` returns a `Map` of word to count.
- `merge(into, from)` adds the counts from `from` into `into` and returns `into`.
- `topWords(counts, n)` returns the top `n` `[word, count]` pairs.

## License

MIT
