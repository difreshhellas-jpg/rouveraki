/**
 * WCAG 2.1 contrast audit of the brand palette (spec §7).
 *
 * Re-run this after replacing the placeholder brand colours with values sampled
 * from the real Rouveraki logo:  npm run contrast
 *
 * AA needs 4.5:1 for body text, 3:1 for large text (>=24px, or >=18.66px bold)
 * and 3:1 for meaningful UI boundaries.
 */
const LIGHT = {
  rust: "#b2502e",
  navy: "#123449",
  sand: "#f6efe6",
  char: "#2b2622",
  gold: "#b07a1e",
  surface: "#fffaf3",
  line: "#e0d3c2",
  onRust: "#ffffff",
  white: "#ffffff",
};

const DARK = {
  rust: "#d9764f",
  navy: "#8fb6cc",
  sand: "#1b1815",
  char: "#efe9e2",
  gold: "#e0ab55",
  surface: "#262019",
  line: "#413830",
  onRust: "#221c17",
  white: "#ffffff",
};

const srgbToLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

const luminance = (hex: string): number => {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) =>
    srgbToLinear(parseInt(h.slice(i, i + 2), 16) / 255),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a: string, b: string): number => {
  const [la, lb] = [luminance(a), luminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

type Case = { label: string; fg: string; bg: string; min: number };

const cases = (p: typeof LIGHT): Case[] => [
  { label: "body text on page background", fg: p.char, bg: p.sand, min: 4.5 },
  { label: "body text on card surface", fg: p.char, bg: p.surface, min: 4.5 },
  { label: "muted text (75%) on page", fg: mix(p.char, p.sand, 0.75), bg: p.sand, min: 4.5 },
  { label: "price / link accent on page", fg: p.rust, bg: p.sand, min: 4.5 },
  { label: "price / link accent on card", fg: p.rust, bg: p.surface, min: 4.5 },
  { label: "primary button label on rust", fg: p.onRust, bg: p.rust, min: 4.5 },
  { label: "gold accent on page (large text only)", fg: p.gold, bg: p.sand, min: 3 },
  { label: "hairline border against page", fg: p.line, bg: p.sand, min: 1.2 },
  { label: "focus ring against page", fg: p.rust, bg: p.sand, min: 3 },
];

/** Blend fg over bg at the given alpha — how text-char/75 actually renders. */
function mix(fg: string, bg: string, alpha: number): string {
  const parse = (hex: string) =>
    [0, 2, 4].map((i) => parseInt(hex.replace("#", "").slice(i, i + 2), 16));
  const [fr, fg_, fb] = parse(fg);
  const [br, bg_, bb] = parse(bg);
  const c = (f: number, b: number) => Math.round(f * alpha + b * (1 - alpha));
  return `#${[c(fr, br), c(fg_, bg_), c(fb, bb)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

let failures = 0;

for (const [theme, palette] of [
  ["LIGHT", LIGHT],
  ["DARK", DARK],
] as const) {
  console.log(`\n${theme}`);
  console.log("".padEnd(62, "-"));
  for (const c of cases(palette)) {
    const r = ratio(c.fg, c.bg);
    const pass = r >= c.min;
    if (!pass) failures++;
    console.log(
      `${pass ? " ok " : "FAIL"}  ${c.label.padEnd(40)} ${r.toFixed(2)}:1 (need ${c.min})`,
    );
  }
}

console.log("");
if (failures) {
  console.error(`${failures} contrast check(s) FAILED.`);
  process.exit(1);
}
console.log("All contrast checks passed.\n");
