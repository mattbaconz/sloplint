# tally-words

Count word frequency across text files. Pass files or directories; get the most frequent words back as a table or JSON.

Requires Node.js 20 or later. No dependencies.

## Usage

```sh
node bin/tally.js [options] <file|dir>...
```

Run `npm link` in this directory to get a `tally` command instead.

```sh
tally notes.txt
tally --top 5 --min-length 4 docs/
tally --ignore the --ignore and --json README.md
```

Example output:

```
the   42
of    27
and   19

3 files, 311 distinct words
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `--top <n>` | `10` | Show the `n` most frequent words. |
| `--min-length <n>` | `1` | Ignore words shorter than `n` characters. |
| `--ignore <word>` | none | Skip a word. Repeat the flag for several. Case-insensitive. |
| `--json` | off | Print JSON instead of a table. |
| `-h`, `--help` | | Show usage and exit with code 0. |

Running `tally` with no paths prints usage and exits with code 2.

## Behavior

- Directories are searched recursively. Only files ending in `.txt` or `.md` (any case) are read; other files are skipped. A file path you pass directly is subject to the same filter.
- A word is a run of letters, digits and apostrophes in any script, lowercased. Leading and trailing apostrophes are trimmed, so `'hello'` counts as `hello` and `don't` stays whole.
- Counts are combined across all files. Ties are ordered alphabetically.
- Input is read as UTF-8.

## JSON output

```json
{
  "files": 3,
  "words": 311,
  "top": { "the": 42, "of": 27, "and": 19 }
}
```

`files` is the number of files read, `words` is the number of distinct words, and `top` maps each of the top words to its count, most frequent first.

## Library

`src/count.js` exports the counting functions used by the CLI:

- `countWords(text, { minLength = 1, ignore = [] })` returns a `Map` of word to count.
- `merge(into, from)` adds the counts in `from` to `into` and returns `into`.
- `topWords(counts, n)` returns the `n` highest `[word, count]` pairs, ties broken alphabetically.

## License

MIT
