// Design tokens from docs/UI.md ("Field Notes"). The Tailwind theme in src/app/globals.css
// mirrors these values; tests/unit/tokens.test.ts fails if the two drift apart.

export const colors = {
  paper: "#F7F4EE", // page background
  ink: "#1E2320", // text; final CTA band
  inkMuted: "#5C625E", // secondary text, captions, "checked X h ago"
  moss: "#2F6F4F", // visible / up / success only
  amber: "#D98E2B", // "Moved" fill; final CTA button (ink text). Never text on paper
  brick: "#B3443A", // down / alerts / "before" problem only
  jelly: "#279EF2", // mascot and large decorative fills. Never text, never white text on it
  jellyDeep: "#1A5FBF", // primary button (white text), links, focus ring
  border: "rgb(30 35 32 / 0.15)", // ink 15%, 1px: cards, tables, inputs
  successBg: "#E6EFE9", // success badge/banner (moss text)
  errorBg: "#F7E6E3", // error banner (brick text)
  warnBg: "#FBEFD9", // "Moved" badge background
  warnText: "#8A5A12", // "Moved" badge text
  infoBg: "#E3EEFB", // info badge, "You" row tag (jellyDeep text), info banner icon chip
  // Final set (Jeun 2026-11-05)
  white: "#FFFFFF", // surface: cards, fields, banners; text on jellyDeep
  jellyLoading: "#316FC5", // primary button while loading (white text 4.99:1)
  fieldBorder: "rgb(30 35 32 / 0.5)", // ink 50%: domain field edge (3.18:1 on white)
  auroraAmber: "#E8B85A", // aurora ring stop only. Never text
  auroraTeal: "#5FB8B3", // aurora ring stop only. Never text
  // Team workspace (lead, 2026-11-05)
  raised: "#FFFFFF", // selected rows, active tab, composer
} as const;

// Team workspace dark theme ([data-theme="dark"], ENG_HANDOFF_STEP2 §3). Same names, so every component
// switches with the theme. AA on white (#121214): ink 16.30, inkMuted 8.00, jellyDeep 8.20, amber 7.00.
export const darkColors = {
  paper: "#0B0B0C",
  ink: "#F2EFE9",
  inkMuted: "#A9A9AE",
  moss: "#5FBF8E",
  amber: "#D98E2B",
  brick: "#F08A7E",
  jelly: "#279EF2",
  jellyDeep: "#7AAEF5",
  border: "#3A3A3F",
  successBg: "#173626",
  errorBg: "#3B1D1A",
  warnBg: "#3A2A12",
  warnText: "#E8B45F",
  infoBg: "#17263D",
  white: "#121214",
  jellyLoading: "#9DC2F7",
  fieldBorder: "#707077",
  auroraAmber: "#E8B85A",
  auroraTeal: "#5FB8B3",
  raised: "#1E1E21",
} as const;

// [font-size px, line-height px]; mobile -> md+ where UI.md gives two sizes.
export const type = {
  display: [40, 44],
  displayMd: [56, 60],
  h2: [28, 34],
  h2Md: [36, 42],
  h3: [20, 26],
  hero: [48, 52],
  body: [16, 24],
  bodyLg: [18, 28],
  ui: [15, 20],
  caption: [13, 18],
  micro: [10, 14],
  wordmark: [18, 18],
} as const;

export const spacing = [4, 8, 12, 16, 24, 32, 48, 64, 96] as const;
// Final set (Jeun 2026-11-05): pills use rounded-full.
export const radius = { card: 8, surface: 24, banner: 28 } as const;

// Soft shadows (Final set). The only box-shadows allowed; mirrored as --shadow-* in globals.css.
export const shadows = {
  field: "inset 0 1px 0 rgb(255 255 255 / 0.9), 0 10px 26px rgb(26 95 191 / 0.12)",
  button: "inset 0 1px 0 rgb(255 255 255 / 0.25), 0 6px 14px rgb(26 95 191 / 0.3)",
  card: "inset 0 1px 0 rgb(255 255 255 / 0.9), 0 16px 40px rgb(26 95 191 / 0.1)",
  "banner-error": "inset 0 1px 0 rgb(255 255 255 / 0.9), 0 10px 26px rgb(179 68 58 / 0.12)",
  aurora: "0 8px 22px rgb(39 158 242 / 0.18), 0 4px 14px rgb(232 184 90 / 0.12)",
  track: "inset 0 1px 2px rgb(30 35 32 / 0.06)",
  fill: "0 2px 6px rgb(26 95 191 / 0.25)",
} as const;

// The only gradient: the aurora ring on the Google sign-in button.
export const aurora = "linear-gradient(90deg, #E8B85A, #5FB8B3, #279EF2)";
export const maxWidth = 1120;
export const breakpoints = { sm: 640, md: 768, lg: 1024 } as const;
