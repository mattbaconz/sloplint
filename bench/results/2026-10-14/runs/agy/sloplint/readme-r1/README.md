# tally-words

Count word frequency across Markdown and text files from the command line or Node.js.

## Installation

```bash
npm install -g tally-words
```

Or run directly with npx:

```bash
npx tally-words notes.txt
```

## CLI usage

Point `tally` at files, directories, or a mix of both. When given a directory, it scans recursively for `.txt` and `.md` files.

```bash
tally docs/
```

Output:

```text
the   358
a     260
and   227
or    130
in    129
with  118
that  89
on    85
is    84
it    80

18 files, 1767 distinct words
```

### Options

| Option | Default | Description |
| --- | --- | --- |
| `--top <n>` | `10` | Number of frequent words to display |
| `--min-length <n>` | `1` | Minimum word character length |
| `--ignore <word>` | `[]` | Exclude a specific word; repeat for multiple words |
| `--json` | `false` | Output results as JSON |
| `-h, --help` | | Show usage help |

### Examples

Filter short words and stop words:

```bash
tally --top 5 --min-length 4 --ignore with --ignore that docs/
```

Emit JSON for processing with tools like jq:

```bash
tally --json --top 3 README.md
```

Output:

```json
{
  "files": 1,
  "words": 42,
  "top": {
    "tally": 12,
    "words": 9,
    "options": 5
  }
}
```

## Programmatic API

The counting functions are exported from `src/count.js`:

```javascript
import { countWords, merge, topWords } from 'tally-words/src/count.js';

const text = 'Alpha beta gamma alpha.';
const counts = countWords(text, { minLength: 4, ignore: ['beta'] });

console.log(topWords(counts, 2));
// [ ['alpha', 2], ['gamma', 1] ]
```

### `countWords(text, options)`

Counts word occurrences in a string. Words are matched via Unicode letter and number sequences (`[\p{L}\p{N}']+`) with leading and trailing apostrophes trimmed.

Options:
- `minLength`: Minimum character length required to count a word (default: `1`).
- `ignore`: Array of words to exclude from counting (default: `[]`).

Returns a `Map` of lowercase words to frequency counts.

### `merge(into, from)`

Merges word counts from the `from` Map into the `into` Map in place and returns `into`.

### `topWords(counts, n)`

Returns the top `n` entries from a `counts` Map as an array of `[word, count]` pairs, sorted by count descending and alphabetically ascending for ties.

## Requirements

Node.js 20.0.0 or higher.

## License

MIT
