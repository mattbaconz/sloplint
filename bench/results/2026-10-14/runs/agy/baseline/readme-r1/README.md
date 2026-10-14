# tally-words

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue.svg)](package.json)
[![Module Type](https://img.shields.io/badge/module-ESM-informational.svg)](package.json)

**tally-words** is a fast, lightweight, zero-dependency Node.js command-line utility and library designed to compute word frequencies across plain text and Markdown files. It recursively traverses directories, normalizes Unicode words, filters stop words, and presents rankings in clean, aligned text tables or structured JSON.

---

## Table of Contents

- [Key Features](#key-features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [Global Installation (CLI)](#global-installation-cli)
  - [Local Project Dependency](#local-project-dependency)
  - [Direct Execution with npx](#direct-execution-with-npx)
- [Command-Line Usage](#command-line-usage)
  - [Syntax](#syntax)
  - [CLI Options Reference](#cli-options-reference)
  - [CLI Examples](#cli-examples)
    - [Basic File Analysis](#basic-file-analysis)
    - [Recursive Directory Scan](#recursive-directory-scan)
    - [Custom Ranking Limit (`--top`)](#custom-ranking-limit---top)
    - [Filtering Short Words (`--min-length`)](#filtering-short-words---min-length)
    - [Ignoring Stop Words (`--ignore`)](#ignoring-stop-words---ignore)
    - [JSON Output (`--json`)](#json-output---json)
    - [Piping into Shell Tools](#piping-into-shell-tools)
- [Programmatic API](#programmatic-api)
  - [Importing the Module](#importing-the-module)
  - [API Reference](#api-reference)
    - [`countWords(text, options)`](#countwordstext-options)
    - [`merge(into, from)`](#mergeinto-from)
    - [`topWords(counts, n)`](#topwordscounts-n)
  - [Complete API Example](#complete-api-example)
- [Architecture & Implementation Details](#architecture--implementation-details)
  - [Project Directory Structure](#project-directory-structure)
  - [Data Flow Pipeline](#data-flow-pipeline)
  - [Tokenization & Normalization Rules](#tokenization--normalization-rules)
  - [Tie-Breaking Logic](#tie-breaking-logic)
- [Development & Verification](#development--verification)
  - [Local Setup](#local-setup)
  - [Manual Testing](#manual-testing)
- [Troubleshooting & FAQ](#troubleshooting--faq)
- [License](#license)

---

## Key Features

- **Zero External Dependencies**: Built exclusively on the Node.js standard library (`node:fs`, `node:path`, `node:util`).
- **Recursive File Traversal**: Point `tally` at one or more files or directory trees; it automatically traverses subdirectories and processes all `.txt` and `.md` files.
- **Unicode-Aware Tokenization**: Matches letter, numeral, and apostrophe sequences across scripts (`\p{L}`, `\p{N}`) while trimming surrounding punctuation and quotation marks.
- **Flexible Filtering**: Strip out stopwords using repeatable `--ignore <word>` flags and exclude words below a given length threshold using `--min-length <n>`.
- **Deterministic Ranking**: Sorts by frequency descending, with alphabetical sorting applied for ties.
- **Dual Output Modes**: Formats results in a padded console table or outputs clean, indented JSON for automation pipelines.
- **Reusable Core Library**: The tokenization, map aggregation, and sorting logic are modular and can be imported directly into other JavaScript/TypeScript applications.

---

## Prerequisites

- **Node.js**: Version **20.0.0** or higher is required.
  - Relies on Node's native `parseArgs` (`node:util`) and ES Modules.
  - Verify your installed version:
    ```bash
    node -v
    ```

---

## Installation

### Global Installation (CLI)

Install globally using `npm` to make the `tally` command available across your terminal:

```bash
npm install -g tally-words
```

Or link locally during development:

```bash
git clone https://github.com/username/tally-words.git
cd tally-words
npm link
```

### Local Project Dependency

To use the frequency counting functions in your own project:

```bash
npm install tally-words
```

### Direct Execution with npx

Run without permanent installation:

```bash
npx tally-words docs/
```

---

## Command-Line Usage

### Syntax

```bash
tally [options] <file|dir>...
```

At least one target file or directory must be provided. If run with no positional arguments, `tally` displays the usage message and exits with status code `2`.

### CLI Options Reference

| Option | Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `--top <n>` | | Integer | `10` | Show the `n` most frequent words. |
| `--min-length <n>` | | Integer | `1` | Ignore words shorter than `n` characters. |
| `--ignore <word>` | | String (repeatable) | `[]` | Skip a word (case-insensitive). Repeat flag for multiple words. |
| `--json` | | Boolean | `false` | Output results in JSON format (`{ files, words, top }`). |
| `--help` | `-h` | Boolean | `false` | Display help screen and exit with code `0`. |

> **Note on File Extensions:** When scanning files or expanding directories, `tally` filters for files matching the case-insensitive regular expression `/\.(txt|md)$/i`. Non-matching files (e.g., `.js`, `.json`, `.html`) are skipped.

---

### CLI Examples

#### Basic File Analysis

Analyze a single plain text or Markdown file:

```bash
tally README.md
```

*Example Output:*
```text
the        42
words      18
tally      14
frequency  11
options    9
files      8
node       7
command    6
output     6
count      5

1 files, 142 distinct words
```

#### Recursive Directory Scan

Pass one or more directories. `tally` recursively discovers all `.txt` and `.md` files:

```bash
tally notes/ docs/
```

#### Custom Ranking Limit (`--top`)

Display the top 5 most common words instead of the default 10:

```bash
tally --top 5 notes/
```

*Example Output:*
```text
project  24
meeting  19
action   15
review   12
client   10

6 files, 310 distinct words
```

#### Filtering Short Words (`--min-length`)

Ignore short words like "a", "an", "to", "in", or "is":

```bash
tally --min-length 4 articles/
```

#### Ignoring Stop Words (`--ignore`)

Exclude specific words from the tally. The `--ignore` flag can be repeated as many times as necessary:

```bash
tally --ignore the --ignore and --ignore of --ignore to notes/
```

#### JSON Output (`--json`)

Output machine-readable JSON for integration into build scripts or reporting pipelines:

```bash
tally --json --top 3 guide.md
```

*Example Output:*
```json
{
  "files": 1,
  "words": 85,
  "top": {
    "guide": 12,
    "step": 9,
    "install": 7
  }
}
```

#### Piping into Shell Tools

Using `--json` with [`jq`](https://jqlang.github.io/jq/):

```bash
# Extract only the top words object
tally --json docs/ | jq '.top'

# Check total distinct word count
tally --json docs/ | jq '.words'
```

---

## Programmatic API

`tally-words` exposes its core counting, merging, and ranking functions via ES Module exports in `src/count.js`.

### Importing the Module

```javascript
import { countWords, merge, topWords } from 'tally-words/src/count.js';
```

*(Or import directly via relative path in a local project clone: `./src/count.js`)*

---

### API Reference

#### `countWords(text, options)`

Analyzes a string of text and returns a `Map` of normalized words to their frequencies.

- **Parameters:**
  - `text` (*string*): The raw text to process.
  - `options` (*object*, optional):
    - `minLength` (*number*, default: `1`): Minimum character length for counted words.
    - `ignore` (*string[]*, default: `[]`): Array of words to ignore (comparison is case-insensitive).
- **Returns:**
  - `Map<string, number>`: Key-value map where keys are lowercased words and values are occurrence counts.

```javascript
const counts = countWords("It's a sunny day. A very sunny day!", {
  minLength: 2,
  ignore: ['it']
});

console.log(counts);
// Map(4) { "sunny" => 2, "day" => 2, "very" => 1, "it's" => 1 }
```

#### `merge(into, from)`

Merges counts from the `from` map into the `into` map in-place and returns the modified `into` map.

- **Parameters:**
  - `into` (*Map<string, number>*): Target map to accumulate counts into.
  - `from` (*Map<string, number>*): Source map whose counts will be added to `into`.
- **Returns:**
  - `Map<string, number>`: The mutated `into` map.

```javascript
const mapA = new Map([['code', 2], ['test', 1]]);
const mapB = new Map([['code', 3], ['deploy', 1]]);

merge(mapA, mapB);

console.log(mapA);
// Map(3) { "code" => 5, "test" => 1, "deploy" => 1 }
```

#### `topWords(counts, n)`

Ranks words by frequency and returns the top `n` pairs.

- **Parameters:**
  - `counts` (*Map<string, number>*): Map of word counts.
  - `n` (*number*): Number of top results to return.
- **Returns:**
  - `Array<[string, number]>`: Array of `[word, count]` tuples, sorted descending by count. If counts are identical, words are sorted alphabetically ascending.

```javascript
const rankings = topWords(mapA, 2);
console.log(rankings);
// [ ['code', 5], ['deploy', 1] ]
```

---

### Complete API Example

```javascript
import { readFileSync } from 'node:fs';
import { countWords, merge, topWords } from './src/count.js';

const chapter1 = "Call me Ishmael. Some years ago...";
const chapter2 = "There now is your insular city of the Manhattoes...";

// Initialize an empty frequency map
const totalCounts = new Map();

// Process each section
for (const text of [chapter1, chapter2]) {
  const fileCounts = countWords(text, {
    minLength: 3,
    ignore: ['the', 'and', 'for', 'you']
  });
  merge(totalCounts, fileCounts);
}

// Extract the top 5 words
const top5 = topWords(totalCounts, 5);

for (const [word, count] of top5) {
  console.log(`${word}: ${count}`);
}
```

---

## Architecture & Implementation Details

### Project Directory Structure

```text
tally-words/
├── bin/
│   └── tally.js         # Executable CLI script (argument parsing, file traversal, formatting)
├── src/
│   └── count.js         # Core library logic (tokenization, merging, ranking)
├── package.json         # Package configuration and dependencies
└── README.md            # Comprehensive project documentation
```

### Data Flow Pipeline

```text
CLI Arguments
      │
      ▼
parseArgs (node:util) ──► Validates options & extracts file paths
      │
      ▼
Recursive Directory Traversal ──► Filters for *.txt and *.md
      │
      ▼
readFileSync (UTF-8) ──► Loads file contents
      │
      ▼
countWords (src/count.js) ──► Normalizes Unicode & builds frequency Map
      │
      ▼
merge (src/count.js) ──► Aggregates frequency counts across all files
      │
      ▼
topWords (src/count.js) ──► Sorts by count (DESC) + alphabet (ASC)
      │
      ├───[ --json ]──────► JSON.stringify { files, words, top }
      │
      └───[ standard ]────► Padded column table & summary stats
```

### Tokenization & Normalization Rules

1. **Case Normalization**: Input text is converted to lowercase via `.toLowerCase()`.
2. **Character Set**: Tokens are matched using Unicode regular expressions:
   ```javascript
   /[\p{L}\p{N}']+/gu
   ```
   - `\p{L}`: Any Unicode letter (supports accents, Latin, Cyrillic, Greek, CJK, etc.).
   - `\p{N}`: Any Unicode numeral.
   - `'`: Apostrophes for contractions and possessives.
3. **Apostrophe Trimming**: Leading and trailing apostrophes are stripped (`.replace(/^'+|'+$/g, '')`). This ensures single-quoted words (e.g. `'quoted'`) become `quoted`, while preserving intra-word contractions (e.g. `don't`, `it's`).
4. **Length and Ignore Thresholds**: Words shorter than `minLength` or present in the `ignore` set (after case normalization) are omitted.

### Tie-Breaking Logic

When sorting in `topWords`, pairs with identical frequency counts are sorted in lexicographical order:

```javascript
[...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
```

This guarantees deterministic, reproducible output across runs regardless of insertion order.

---

## Development & Verification

### Local Setup

Ensure you have Node.js 20+ installed:

```bash
git clone https://github.com/username/tally-words.git
cd tally-words
```

### Manual Testing

Verify that the CLI executable works directly with Node:

```bash
# Display help
node bin/tally.js --help

# Create a temporary file to test counting
echo "Node tally counts words. Words and node!" > sample.txt

# Run tally
node bin/tally.js sample.txt

# Run with options
node bin/tally.js sample.txt --min-length 4 --ignore words --json

# Clean up
rm sample.txt
```

---

## Troubleshooting & FAQ

### Why did tally report "0 files, 0 distinct words"?
`tally` strictly processes files ending with `.txt` or `.md`. If you pass other file types (e.g., `tally data.csv` or `tally script.js`), they will be ignored by the file extension filter.

### Why do I receive exit code `2`?
Running `tally` without any file or directory arguments triggers the usage display and exits with status code `2`. Always provide at least one target file or directory path.

### Can I specify multiple directories and files at once?
Yes. Positional arguments accept any combination of files and directories:
```bash
tally file1.txt docs/ notes/archive.md
```

### Does `tally` support non-English text?
Yes. The tokenizer uses Unicode property escapes (`\p{L}` and `\p{N}`), allowing it to accurately recognize words containing accented characters, umlauts, and non-Latin scripts (e.g., French, German, Spanish, Russian, Japanese, etc.).

---

## License

This project is licensed under the [MIT License](LICENSE). See [package.json](package.json) for details.
