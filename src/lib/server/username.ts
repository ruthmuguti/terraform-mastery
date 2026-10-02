/**
 * Pure username helpers — no I/O, no imports needed.
 */

/**
 * Strips everything except [A-Za-z0-9_-], trims to 32 characters.
 * Returns "agent" if the result is empty.
 */
export function toUsername(base: string): string {
  const clean = base.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  return clean.length > 0 ? clean : "agent";
}

/**
 * Picks a username not in `taken`.
 * - Starts with `toUsername(base)`.
 * - If taken, tries `<clean>-2` through `<clean>-20`.
 * - If all taken, returns `<clean>-` + 6 random hex chars (Math.random,
 *   display-only — not a security concern).
 */
export function pickUsername(base: string, taken: Set<string>): string {
  const clean = toUsername(base);

  if (!taken.has(clean)) {
    return clean;
  }

  for (let i = 2; i <= 20; i++) {
    const candidate = `${clean}-${i}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  // Fallback: 6 random hex chars
  let fallback: string;
  do {
    const hex = Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, "0");
    fallback = `${clean}-${hex}`;
  } while (taken.has(fallback));

  return fallback;
}
