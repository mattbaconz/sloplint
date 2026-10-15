# tally-words

Word frequency counter for text and Markdown files, available as a command-line tool and a Node.js library.

`tally-words` scans `.txt` and `.md` files, normalizes word tokens, aggregates frequencies across directories, and outputs rankings as formatted tables or JSON.

## Requirements

Node.js 20.0.0 or higher. The package uses Node.js built-in modules (`node:fs`, `node:path`, `node:util`) with zero runtime dependencies.

## Installation

Install globally to use the `tally` command:

```bash
npm install -g tally-words
```

Or add as a dependency in a local project:

```bash
npm install tally-words
```

You can also run the CLI script directly using Node.js without installation:

```bash
node bin/tally.js <file|dir>...
```

## Command-Line Usage

```bash
tally [options] <file|dir>...
```

Pass one or more file or directory paths. Directory arguments are traversed recursively.

### Options

| Option | Description | Default |
| --- | --- | --- |
| `--top <n>` | Show the n most frequent words | `10` |
| `--min-length <n>` | Ignore words shorter than n characters | `1` |
| `--ignore <word>` | Skip a word; repeat the flag to ignore multiple words | none |
| `--json` | Print output as JSON containing file count, word count, and top words | disabled |
| `-h`, `--help` | Show usage instructions and exit | |

### Examples

Analyze a single file:

```bash
tally notes.txt
```

Display the top 5 most common words:

```bash
tally --top 5 notes.txt
```

Filter out short words and common stopwords across a directory:

```bash
tally --min-length 4 --ignore the --ignore with --ignore that docs/
```

Scan multiple files and folders together:

```bash
tally notes.txt guide.md articles/
```

Format output as structured JSON:

```bash
tally --json --top 5 docs/
```

### Output Formats

Standard table output:

```text
word       42
frequency  28
text       15

3 files, 142 distinct words
```

JSON output (`--json`):

```json
{
  "files": 3,
  "words": 142,
  "top": {
    "word": 42,
    "frequency": 28,
    "text": 15
  }
}
```

## Behavior and Normalization

- File discovery: Only files ending with `.txt` or `.md` extensions (case-insensitive) are read. Other file types are ignored even when passed explicitly.
- Tokenization: Tokens match Unicode letter, number, and apostrophe sequences (`/[\p{L}\p{N}']+/gu`). Characters are converted to lowercase. Leading and trailing apostrophes are removed while retaining internal apostrophes (such as in contractions).
- Word filtering: Words with length less than `--min-length` or matching any word specified via `--ignore` (case-insensitive) are excluded.
- Ranking and tie-breaking: Word counts are sorted by frequency descending. Words with identical counts are sorted alphabetically in ascending order.
- Exit codes: Exits with code 0 on normal completion or when `--help` is passed. Exits with code 2 if no path arguments are provided.

## Programmatic API

Import the functions from `src/count.js`:

```javascript
import { countWords, merge, topWords } from 'tally-words/src/count.js';

const text = 'The quick brown fox jumps over the lazy dog.';
const counts = countWords(text, { minLength: 4, ignore: ['over'] });

const extraText = 'Quick foxes running.';
const extraCounts = countWords(extraText, { minLength: 4 });
merge(counts, extraCounts);

const top = topWords(counts, 3);
// [ ['quick', 2], ['brown', 1], ['fox', 1] ]
```

### API Reference

#### `countWords(text, options)`

Counts word occurrences in a text string.

- `text` *(string)*: Raw text string.
- `options` *(object, optional)*:
  - `minLength` *(number)*: Minimum word length to tally. Default is `1`.
  - `ignore` *(string[])*: Array of words to skip (case-insensitive). Default is `[]`.
- Returns: `Map<string, number>` mapping lowercased words to their count.

#### `merge(into, from)`

Merges word counts from the `from` Map into the `into` Map in place.

- `into` *(Map<string, number>)*: Destination Map updated in place.
- `from` *(Map<string, number>)*: Source Map containing counts to add.
- Returns: The updated `into` Map.

#### `topWords(counts, n)`

Extracts the top `n` words sorted by frequency.

- `counts` *(Map<string, number>)*: Map of word frequencies.
- `n` *(number)*: Maximum number of entries to return.
- Returns: `Array<[string, number]>` sorted by count descending, then alphabetically ascending.

## License

MIT
