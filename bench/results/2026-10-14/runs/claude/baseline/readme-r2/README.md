# tally-words

Count word frequency across text files.

Requires Node.js 20 or later. No dependencies.

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

Directories are searched recursively, and only `.txt` and `.md` files are read (case-insensitive). Counts are merged across all files.

### Examples

```sh
# Top 10 words in a directory of notes
tally notes/

# Top 5 words of at least 4 letters, skipping a few
tally --top 5 --min-length 4 --ignore this --ignore that README.md docs/

# Machine-readable output
tally --json --top 3 essay.txt
```

Default output is one `word  count` line per word, followed by a summary:

```
the  42
and  31
...

3 files, 518 distinct words
```

With `--json`:

```json
{
  "files": 1,
  "words": 120,
  "top": { "the": 9, "of": 5, "to": 4 }
}
```

### How words are counted

- Text is lowercased, so `The` and `the` count as one word.
- A word is a run of letters, digits and apostrophes (Unicode-aware). Leading and trailing apostrophes are trimmed, so `don't` stays whole but `'quoted'` becomes `quoted`.
- Ties in the top list are sorted alphabetically.
- `--ignore` matching is case-insensitive.

### Exit status

`0` on success or with `--help`; `2` when no file or directory is given (usage is printed).

## Library use

The counting functions are in `src/count.js`:

```js
import { countWords, merge, topWords } from './src/count.js';

const counts = countWords('The cat and the hat', { minLength: 3, ignore: ['hat'] });
topWords(counts, 2); // [['the', 2], ['and', 1]]
```

- `countWords(text, { minLength, ignore })` returns a `Map` of word to count.
- `merge(into, from)` adds the counts in `from` to `into` and returns `into`.
- `topWords(counts, n)` returns the `n` most frequent `[word, count]` pairs.

## License

MIT
