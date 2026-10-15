# tally-words

Count word frequency across plain text and Markdown files.

## Installation

Install globally using npm:

```bash
npm install -g tally-words
```

Or run directly with npx:

```bash
npx tally [options] <file|dir>...
```

## Requirements

Node.js 20 or later.

## Usage

Pass one or more file paths or directories:

```bash
tally README.md
```

When given a directory, tally recursively scans for `.txt` and `.md` files:

```bash
tally docs/
```

### Options

- `--top <n>`: Number of words to display (default: `10`).
- `--min-length <n>`: Ignore words shorter than `n` characters (default: `1`).
- `--ignore <word>`: Skip a word. Repeat the flag to ignore multiple words.
- `--json`: Output results as JSON.
- `-h`, `--help`: Show command help.

### Examples

Display the 5 most frequent words of at least 4 characters:

```bash
tally --top 5 --min-length 4 notes.md
```

Ignore common stop words:

```bash
tally --ignore the --ignore and --ignore of articles/
```

Output results as JSON:

```bash
tally --json notes.txt
```

Example JSON output:

```json
{
  "files": 1,
  "words": 142,
  "top": {
    "project": 12,
    "words": 8,
    "count": 5
  }
}
```

## JavaScript API

You can also import counting functions directly:

```javascript
import { countWords, merge, topWords } from './src/count.js';

const counts = countWords('Sample text for word counting.', {
  minLength: 4,
  ignore: ['text']
});

const top = topWords(counts, 5);
```

### Functions

- `countWords(text, options)`: Returns a `Map` of word frequencies for the provided string. Options support `minLength` (number) and `ignore` (array of words).
- `merge(into, from)`: Combines word counts from Map `from` into Map `into`.
- `topWords(counts, n)`: Returns an array of `[word, count]` pairs for the top `n` words, sorted descending by count and alphabetically by word on ties.

## License

MIT
