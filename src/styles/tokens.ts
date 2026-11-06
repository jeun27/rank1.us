// Design tokens, v3 (design/direction.md §7, founder 2026-11-06: Supabase-style dark). The Tailwind
// theme in src/app/globals.css mirrors these values; tests/unit/tokens.test.ts fails if they drift apart.
// Dark is the default on every surface; `colors` is the O2 light theme (/app and /team toggle), and stays
// the palette of the PDF report and the audit PNG.

// Dark (default). AA on panel #151619: ink 15.58, text2 9.00, muted 5.72, link 9.25, Jelly 6.25.
export const darkColors = {
  paper: "#0E0F11", // page
  white: "#151619", // panel: cards, fields, banners ("white" = the surface token in both themes)
  raised: "#1C1E22", // selected rows, active tab, secondary buttons
  overlay: "#24262B", // menus, popovers
  ink: "#EDEEF0", // text
  text2: "#B3B7BF", // secondary text
  inkMuted: "#8C919B", // muted text, captions, "checked X h ago"
  border: "#2B2E34", // hairline (decorative divider only)
  borderStrong: "#41454D", // strong hairline
  fieldBorder: "#71767F", // control edge (≥ 3:1)
  accent: "#279EF2", // primary button fill, active icon, chart line (Jelly blue)
  onAccent: "#0E0F11", // text on accent (6.63)
  jellyLoading: "#4FAEF7", // primary hover and loading
  jelly: "#279EF2", // mascot and decorative fills
  jellyDeep: "#79C0FA", // links and focus ring
  moss: "#5FBF8E",
  successBg: "#13291F",
  brick: "#F08A7E",
  errorBg: "#33191A",
  amber: "#D98E2B", // "Moved" fill and chart series only. Never a button, never text
  warnText: "#E8B45F",
  warnBg: "#2E2312",
  infoBg: "#14263B",
  auroraAmber: "#E8B85A", // aurora ring stop only
  auroraTeal: "#5FB8B3", // aurora ring stop only
  // Chart series (lead, v3 PR 1; supersedes Step 9 Q3 O1): 3 solids, validated on the dark panel.
  series1: "#3987E5",
  series2: "#D95926",
  series3: "#199E70",
} as const;

// Light (O2): cool grey, no beige. Same names, so every component switches with data-theme.
export const colors = {
  paper: "#F6F7F9",
  white: "#FFFFFF",
  raised: "#F0F2F5",
  overlay: "#E8EBEF",
  ink: "#111316",
  text2: "#4A4F57",
  inkMuted: "#646A73",
  border: "#E2E5EA",
  borderStrong: "#CDD1D8",
  fieldBorder: "#7D838D",
  accent: "#1A5FBF",
  onAccent: "#FFFFFF",
  jellyLoading: "#18579F",
  jelly: "#279EF2",
  jellyDeep: "#1A5FBF",
  moss: "#2F6F4F",
  successBg: "#E6EFE9",
  brick: "#B3443A",
  errorBg: "#F7E6E3",
  amber: "#D98E2B",
  warnText: "#8A5A12",
  warnBg: "#FBEFD9",
  infoBg: "#E5EFFC",
  auroraAmber: "#E8B85A",
  auroraTeal: "#5FB8B3",
  // Light keeps the Step 9 hues for the 3 solids.
  series1: "#1A5FBF",
  series2: "#D98E2B",
  series3: "#279EF2",
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
// v3 (D35/D36): 6px controls, 8px panels and banners.
export const radius = { control: 6, card: 8, surface: 8, banner: 8 } as const;

// v3 (D36): hairlines instead of shadows. The names stay so components need no change; only overlay menus,
// the Google button and the demo window lift keep a real shadow. Mirrored as --shadow-* in globals.css.
export const shadows = {
  field: "0 0 #0000",
  button: "0 0 #0000",
  card: "0 0 0 1px var(--color-border)",
  "banner-error": "0 0 #0000",
  aurora: "0 8px 22px rgb(39 158 242 / 0.18), 0 4px 14px rgb(232 184 90 / 0.12)",
  track: "0 0 #0000",
  fill: "0 0 #0000",
  overlay: "0 12px 32px rgb(0 0 0 / 0.4)",
} as const;

// The only gradient: the aurora ring on the Google sign-in button.
export const aurora = "linear-gradient(90deg, #E8B85A, #5FB8B3, #279EF2)";
export const maxWidth = 1120;
export const breakpoints = { sm: 640, md: 768, lg: 1024 } as const;
