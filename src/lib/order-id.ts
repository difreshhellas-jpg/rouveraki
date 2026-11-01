/**
 * The shop screen addresses orders by number; shared demo orders are known by
 * their 6-character code. This maps one to the other, both ways.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export const codeToId = (code: string): number =>
  [...code].reduce((n, ch) => n * ALPHABET.length + ALPHABET.indexOf(ch), 0) + 1;

export const idToCode = (id: number): string => {
  let n = id - 1;
  let out = "";
  for (let i = 0; i < 6; i++) {
    out = ALPHABET[n % ALPHABET.length] + out;
    n = Math.floor(n / ALPHABET.length);
  }
  return out;
};
