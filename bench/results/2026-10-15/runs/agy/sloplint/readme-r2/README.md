# tally-words

Count word frequency across plain text and Markdown files from the command line or Node.js.

## Installation

```bash
npm install -g tally-words
```

Or run without installing:

```bash
npx tally-words notes/
```

Requires Node.js 20 or later.

## Usage

Pass one or more text files or directories:

```bash
tally docs/ notes/draft.md
```

`tally` recursively scans directories for `.txt` and `.md` files, normalizes words to lowercase, and prints the most frequent words:

```text
the       142
and        98
in         64
to         53
of         47

12 files, 834 distinct words
```

## Options

| Option | Description | Default |
| --- | --- | --- |
| `--top <n>` | Show the n most frequent words | `10` |
| `--min-length <n>` | Ignore words shorter than n characters | `1` |
| `--ignore <word>` | Skip a word (repeatable for multiple words) | None |
| `--json` | Print counts as JSON | `false` |
| `-h, --help` | Show help text | |

## Examples

Find the top 5 words with at least 4 letters:

```bash
tally --min-length 4 --top 5 notes/
```

Filter out stop words:

```bash
tally --ignore the --ignore and --ignore that article.txt
```

Output JSON for script processing:

```bash
tally --json --top 3 report.md
```

JSON output structure:

```json
{
  "files": 1,
  "words": 344,
  "top": {
    "summary": 12,
    "results": 9,
    "metrics": 7
  }
}
```

## Programmatic API

The counting logic can be imported into Node.js applications:

```javascript
import { countWords, merge, topWords } from 'tally-words/src/count.js';

const text = 'First sentence. Second sentence with words.';
const counts = countWords(text, { minLength: 3, ignore: ['with'] });

const moreCounts = countWords('Another sentence.');
merge(counts, moreCounts);

const top = topWords(counts, 5);
// [ ['sentence', 3], ['another', 1], ['first', 1], ['second', 1], ['words', 1] ]
```

### Functions

- `countWords(text, options)`: Returns a `Map` of word to occurrence count. Words match Unicode letter and number sequences (`[\p{L}\p{N}']+`), lowercased, with boundary apostrophes stripped. Supported options:
  - `minLength`: Minimum character length (default: `1`).
  - `ignore`: Array of words to exclude (case-insensitive).
- `merge(into, from)`: Merges the `from` map counts into `into` in place and returns `into`.
- `topWords(counts, n)`: Returns an array of up to `n` `[word, count]` tuples sorted by count descending, then alphabetically ascending.

## License

MIT
