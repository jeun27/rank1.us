import { colors } from "@/styles/tokens";

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// The report accent: the business's brand color only when it passes AA (4.5:1) on white, else ink.
export function accentColor(brand: string | null | undefined): string {
  const hex = brand?.trim().toLowerCase();
  if (!hex || !/^#[0-9a-f]{6}$/.test(hex)) return colors.ink;
  return contrast(hex, "#ffffff") >= 4.5 ? hex : colors.ink;
}
