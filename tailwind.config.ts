import type { Config } from "tailwindcss";

/**
 * Brand tokens live in src/app/globals.css as CSS custom properties so that the
 * dark-mode overrides in that file are the single source of truth. Tailwind maps
 * onto the `-rgb` channel variants so opacity modifiers (bg-rust/40) keep working.
 */
const withAlpha = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Semantic names. Use these in new code.
        paper: withAlpha("--paper-rgb"),
        surface: withAlpha("--surface-rgb"),
        surface2: withAlpha("--surface-2-rgb"),
        ink: withAlpha("--ink-rgb"),
        stone: withAlpha("--stone-rgb"),
        line: withAlpha("--line-rgb"),
        band: withAlpha("--band-rgb"),
        onband: withAlpha("--on-band-rgb"),
        accent: withAlpha("--accent-rgb"),
        accentBright: withAlpha("--accent-bright-rgb"),
        onaccent: withAlpha("--on-accent-rgb"),
        // Legacy keys, aliased in globals.css so existing classes keep working.
        rust: withAlpha("--rouveraki-rust-rgb"),
        navy: withAlpha("--rouveraki-navy-rgb"),
        sand: withAlpha("--rouveraki-sand-rgb"),
        char: withAlpha("--rouveraki-char-rgb"),
        gold: withAlpha("--rouveraki-gold-rgb"),
        onrust: withAlpha("--rouveraki-on-rust-rgb"),
      },
      fontFamily: {
        display: ["var(--font-display)", "Noto Serif", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        // 16px floor on mobile body text (spec §2)
        base: ["1rem", { lineHeight: "1.6" }],
      },
      spacing: {
        touch: "2.75rem", // 44px minimum touch target (spec §7)
      },
      maxWidth: {
        content: "72rem",
      },
      borderRadius: {
        card: "0.875rem",
      },
      boxShadow: {
        // Defined per theme in globals.css so the tint follows the page hue.
        card: "var(--shadow-card)",
        lift: "var(--shadow-lift)",
        accent: "var(--shadow-accent)",
      },
      keyframes: {
        "rise-in": {
          from: { opacity: "0", transform: "translateY(18px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "cart-bump": {
          "0%, 100%": { transform: "scale(1)" },
          "45%": { transform: "scale(1.045)" },
        },
        "count-pop": {
          from: { transform: "scale(0.62)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%": { transform: "scale(1.6)", opacity: "0" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
      },
      animation: {
        "rise-in": "rise-in 600ms cubic-bezier(0.22,1,0.36,1) both",
        "pulse-ring": "pulse-ring 1.8s ease-out infinite",
        "cart-bump": "cart-bump 260ms cubic-bezier(0.23,1,0.32,1)",
        "count-pop": "count-pop 200ms cubic-bezier(0.23,1,0.32,1)",
      },
    },
  },
  plugins: [],
};

export default config;
