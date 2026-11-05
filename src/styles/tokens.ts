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
  infoBg: "#E3EEFB", // info badge, "You" row tag (jellyDeep text)
} as const;

// [font-size px, line-height px]; mobile -> md+ where UI.md gives two sizes.
export const type = {
  display: [40, 44], displayMd: [56, 60],
  h2: [28, 34], h2Md: [36, 42],
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
export const radius = 8;
export const maxWidth = 1120;
export const breakpoints = { sm: 640, md: 768, lg: 1024 } as const;
