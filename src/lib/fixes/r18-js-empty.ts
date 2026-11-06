import type { AiAccessInput } from "@/lib/queries/ai-access";
import { JS_EMPTY_WORDS } from "@/lib/site/ai-access";
import { fix, ok, unchecked, type FixResult } from "./types";

// R18 (G2, lead 2026-11-06): the homepage shows almost no text with JavaScript off, and AI crawlers
// don't run JavaScript. Decided by the word count alone, so a crawler block never hides it.
export function checkJsEmpty(check: AiAccessInput | null): FixResult {
  if (!check) return unchecked("R18", "no_domain");
  if (check.outcome === "unreachable" || check.visibleWords === null) return unchecked("R18", "site_unreachable");
  if (check.visibleWords < JS_EMPTY_WORDS) return fix("R18", { visible_words: check.visibleWords });
  return ok("R18", { visible_words: check.visibleWords });
}
