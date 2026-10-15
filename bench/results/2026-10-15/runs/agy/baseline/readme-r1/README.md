# tally-words

Count word frequency across text files from the command line or as a Node.js module.

`tally-words` scans `.txt` and `.md` files, normalizes words, tallies frequencies across documents, and outputs sorted results as a formatted table or structured JSON.

## Prerequisites

Node.js 20 or higher. The package has zero external dependencies and uses standard Node.js APIs (`node:fs`, `node:path`, `node:util`).

## Installation

Install globally via npm to use the `tally` command from any directory:

```sh
npm install -g tally-words
```

Or install locally in a project:

```sh
npm install tally-words
```

You can also run the CLI directly from the repository without installing:

```sh
node bin/tally.js <file|dir>...
```

## CLI Usage

```sh
tally [options] <file|dir>...
```

Provide one or more file paths or directory paths. Directories are traversed recursively.

### Options

| Option | Description | Default |
| --- | --- | --- |
| `--top <n>` | Show the n most frequent words | `10` |
| `--min-length <n>` | Ignore words shorter than n characters | `1` |
| `--ignore <word>` | Skip a word; repeat the flag to ignore several | none |
| `--json` | Print {"files", "words", "top"} as JSON | off |
| `-h`, `--help` | Show this help | |

When invoked with `--help` or `-h`, `tally` displays the usage message and exits with status 0. If invoked with no paths, it prints the usage message and exits with status 2.

### Examples

Find the 10 most frequent words in a Markdown document:

```sh
tally README.md
```

Inspect the top 5 words in a document:

```sh
tally --top 5 notes.txt
```

Scan an entire directory while filtering out short words and common stopwords:

```sh
tally --min-length 4 --ignore the --ignore that --ignore with docs/
```

Scan multiple files and directories together:

```sh
tally guide.md notes.txt articles/
```

Generate JSON output:

```sh
tally --json --top 3 src/
```

### Example Output

Default table format:

```
word   42
other  17

2 files, 311 distinct words
```

JSON format (`--json`):

```json
{
  "files": 2,
  "words": 311,
  "top": {
    "word": 42,
    "other": 17
  }
}
```

## How It Works

- **File Discovery**: Recursively traverses supplied directories. Only files ending in `.txt` or `.md` (case-insensitive) are read. Files with other extensions are ignored even when passed explicitly.
- **Tokenization**: Extracts words matching Unicode letter, number, and apostrophe sequences (`/[\p{L}\p{N}']+/gu`). Leading and trailing apostrophes are stripped (for example, `'hello'` becomes `hello`, while internal contractions like `don't` are preserved).
- **Case Normalization**: All text is lowercased before counting, so capitalized words match lowercase occurrences.
- **Word Filtering**: Words shorter than `--min-length` or included in `--ignore` (case-insensitive) are excluded.
- **Aggregation & Sorting**: Counts are summed across all matching files. Results are sorted primarily by frequency in descending order; ties are sorted alphabetically in ascending order.

## Programmatic API

The counting logic can be imported directly into Node.js applications:

```js
import { countWords, merge, topWords } from 'tally-words/src/count.js';

// Count words in a string
const counts = countWords("The quick brown fox jumps over the lazy dog.", {
  minLength: 4,
  ignore: ['over']
});
// Map(4) { 'quick' => 1, 'brown' => 1, 'jumps' => 1, 'lazy' => 1 }

// Merge two frequency maps
const extraCounts = countWords("Another quick brown fox.");
merge(counts, extraCounts);

// Retrieve top n words as [word, count] entries
const top = topWords(counts, 2);
// [ ['brown', 2], ['quick', 2] ]
```

### API Reference

#### `countWords(text, options)`

Counts word frequencies in a string of text.

- `text` *(string)*: Plain text input.
- `options` *(object, optional)*:
  - `minLength` *(number)*: Minimum word length to include. Default is `1`.
  - `ignore` *(string[])*: Array of words to ignore. Matching is case-insensitive. Default is `[]`.
- Returns: `Map<string, number>` mapping each lowercased word to its occurrence count.

#### `merge(into, from)`

Merges word counts from the `from` Map into the `into` Map in place.

- `into` *(Map<string, number>)*: Target map receiving the counts.
- `from` *(Map<string, number>)*: Source map containing counts to add.
- Returns: `into` with updated totals.

#### `topWords(counts, n)`

Extracts and sorts the highest frequency words.

- `counts` *(Map<string, number>)*: Word count map.
- `n` *(number)*: Maximum number of entries to return.
- Returns: `Array<[string, number]>` sorted by count descending, then alphabetically ascending.

## License

MIT
