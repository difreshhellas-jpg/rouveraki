/**
 * WCAG 2.1 contrast audit of the brand palette (spec §7).
 *
 * Re-run this after replacing the placeholder brand colours with values sampled
 * from the real Rouveraki logo:  npm run contrast
 *
 * AA needs 4.5:1 for body text, 3:1 for large text (>=24px, or >=18.66px bold)
 * and 3:1 for meaningful UI boundaries.
 */
// Keys keep their legacy names so the cases below read unchanged:
// rust = accent (gold), gold = accent-bright, sand = paper, char = ink.
const LIGHT = {
  rust: "#a16207",
  navy: "#1c1917",
  sand: "#f8f6f1",
  char: "#0c0a09",
  gold: "#a56408",
  surface: "#fdfcfa",
  line: "#e4e0d8",
  onRust: "#ffffff",
  stone: "#57534e",
  white: "#ffffff",
};

const DARK = {
  rust: "#e0b458",
  navy: "#050403",
  sand: "#0c0a09",
  char: "#faf9f6",
  gold: "#f0c86e",
  surface: "#1c1917",
  line: "#363230",
  onRust: "#0c0a09",
  stone: "#a8a29e",
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
  { label: "secondary (stone) text on page", fg: p.stone, bg: p.sand, min: 4.5 },
  { label: "secondary (stone) text on card", fg: p.stone, bg: p.surface, min: 4.5 },
  { label: "price / link accent on page", fg: p.rust, bg: p.sand, min: 4.5 },
  { label: "price / link accent on card", fg: p.rust, bg: p.surface, min: 4.5 },
  { label: "primary button label on rust", fg: p.onRust, bg: p.rust, min: 4.5 },
  { label: "button label on accent-bright (hover)", fg: p.onRust, bg: p.gold, min: 4.5 },
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
