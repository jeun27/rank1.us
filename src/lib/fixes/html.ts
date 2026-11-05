import { pageText } from "@/lib/onboarding/read-site";

// Small HTML helpers for the site rules. Regex-level parsing on capped pages; no LLM.
export const PRICE = /(?:\$\s?\d{1,3}(?:[.,]\d{2})?|\b\d{1,3}[.,]\d{2}\b)/g;

export const prices = (text: string) => text.match(PRICE)?.length ?? 0;
export const images = (html: string) => html.match(/<img\b/gi)?.length ?? 0;

// Text with one line per block element, so a menu row stays one line.
export function lines(html: string): string[] {
  const blocked = html
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|li|div|tr|td|h[1-6]|dt|dd|section|article)>/gi, "\n");
  return blocked
    .split("\n")
    .map((l) => pageText(l))
    .filter(Boolean);
}

export function links(html: string): { href: string; text: string }[] {
  return [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({
    href: m[1].trim(),
    text: pageText(m[2]),
  }));
}

export const headings = (html: string) =>
  [...html.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => pageText(m[1]));

export function jsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      out.push(JSON.parse(m[1]));
    } catch {
      // Broken JSON-LD counts as none.
    }
  }
  return out;
}

// Every object in a JSON-LD value, including @graph members and nested values.
export function ldNodes(v: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(v)) v.forEach((x) => ldNodes(x, out));
  else if (v && typeof v === "object") {
    out.push(v as Record<string, unknown>);
    Object.values(v).forEach((x) => ldNodes(x, out));
  }
  return out;
}

export const ldTypes = (n: Record<string, unknown>) =>
  [n["@type"]].flat().filter((t): t is string => typeof t === "string");

// FAQ text: <details>/<summary>, blocks whose id or class says faq, and FAQPage JSON-LD.
export function faqText(html: string): string {
  const parts = [
    ...[...html.matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/gi)].map((m) => m[1]),
    ...[
      ...html.matchAll(
        /<(section|div|ul|ol|dl)\b[^>]*(?:id|class)\s*=\s*["'][^"']*faq[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi,
      ),
    ].map((m) => m[2]),
  ].map((h) => pageText(h));
  for (const n of jsonLd(html).flatMap((v) => ldNodes(v)))
    if (ldTypes(n).some((t) => t === "FAQPage" || t === "Question" || t === "Answer")) {
      for (const k of ["name", "text"]) if (typeof n[k] === "string") parts.push(n[k] as string);
    }
  return parts.join(" \n ");
}
