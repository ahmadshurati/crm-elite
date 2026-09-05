/**
 * Car/plate number helpers for duplicate detection.
 *
 * Duplicate matching ignores formatting differences (spaces, dashes, slashes,
 * dots) and letter case so that "12-345-67", "1234567" and "12 345 67" all
 * collapse to the same key.
 */

/** Normalize a car/plate number to a comparison key. */
export function normalizeCarNumber(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s\-/.]/g, "");
}

/**
 * SQL expression that normalizes a car-number column to match
 * normalizeCarNumber(). Keep the REPLACE list in sync with the regex above.
 */
export function sqlNormalizedCarNumber(column: string): string {
  return `UPPER(REPLACE(REPLACE(REPLACE(REPLACE(${column}, ' ', ''), '-', ''), '/', ''), '.', ''))`;
}
