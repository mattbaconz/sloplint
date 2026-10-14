# tally-words

Count word frequency across plain text and Markdown files.

## Install

```bash
npm install -g tally-words
```

## Usage

Pass one or more file or directory paths to `tally`. Directories are traversed recursively for `.txt` and `.md` files.

```bash
tally notes/ chapter1.txt
```

```text
the      42
system   19
memory   15
cache    12
process  10

2 files, 312 distinct words
```

### Options

```text
--top <n>          Show the n most frequent words (default 10)
--min-length <n>   Ignore words shorter than n characters (default 1)
--ignore <word>    Skip a word; repeat for several
--json             Print {"files", "words", "top"} as JSON
-h, --help         Show this help
```

### Examples

Filter out short words and specific terms:

```bash
tally docs/ --min-length 4 --ignore the --ignore with
```

Output as JSON:

```bash
tally docs/ --json
```

```json
{
  "files": 4,
  "words": 528,
  "top": {
    "system": 18,
    "memory": 11,
    "signal": 10
  }
}
```

### Programmatic API

Import `countWords`, `merge`, and `topWords` from `src/count.js`:

```javascript
import { countWords, topWords } from 'tally-words/src/count.js';

const counts = countWords('Read books, write tests, read docs.', {
  minLength: 4,
  ignore: ['docs']
});

const top = topWords(counts, 2);
// [ ['read', 2], ['books', 1] ]
```

## License

MIT
