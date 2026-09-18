/**
 * Public order code. Deliberately random, never sequential — the code is the
 * only credential on /order/[code], so a guessable code is an IDOR.
 *
 * Alphabet excludes 0/O/1/I/L so the code survives being read aloud on the
 * phone. 6 chars over a 31-symbol alphabet is about 8.9e8 combinations.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Uses Web Crypto rather than node:crypto so this module stays resolvable in
 * every bundling layer (pages import the shape check from here).
 *
 * Rejection sampling, not modulo: 256 is not a multiple of 31, so `% 31` would
 * make the first few letters of the alphabet very slightly more likely.
 */
export const generateOrderCode = (length = 6): string => {
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let out = "";
  while (out.length < length) {
    const bytes = new Uint8Array(length * 2);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b >= limit) continue;
      out += ALPHABET[b % ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
};

/** Cheap shape check before user input ever reaches the database. */
export const isOrderCodeShape = (v: string): boolean =>
  /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6,10}$/.test(v);
