// Word frequency over plain text. Words are lowercased runs of letters, digits and apostrophes.

export function countWords(text, { minLength = 1, ignore = [] } = {}) {
  const skip = new Set(ignore.map((w) => w.toLowerCase()));
  const counts = new Map();
  for (const match of text.toLowerCase().matchAll(/[\p{L}\p{N}']+/gu)) {
    const word = match[0].replace(/^'+|'+$/g, '');
    if (word.length < minLength || skip.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return counts;
}

export function merge(into, from) {
  for (const [word, n] of from) into.set(word, (into.get(word) ?? 0) + n);
  return into;
}

export function topWords(counts, n) {
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
}
