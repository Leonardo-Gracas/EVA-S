const COMBINING = /[̀-ͯ]/g;

/** Removes accents and lowercases — "ã" → "a", "Â" → "a", etc. */
export function normalize(str: string): string {
  return str.normalize('NFD').replace(COMBINING, '').toLowerCase();
}

/** Returns true if `text` contains `query` after normalization. */
export function matchesSearch(text: string, query: string): boolean {
  if (!query) return true;
  return normalize(text).includes(normalize(query));
}
