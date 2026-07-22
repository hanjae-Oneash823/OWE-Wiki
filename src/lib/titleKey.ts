/** Normalizes a note title/alias for case- and whitespace-insensitive lookup. */
export function normalizeTitle(value: string): string {
  return value.trim().toLowerCase();
}
