import type { AiAccessInput } from "@/lib/queries/ai-access";
import { fix, ok, unchecked, type FixResult } from "./types";

// R16 (G2): Cloudflare in front of a site whose robots.txt lets the AI crawlers in. A hint, not proof:
// Cloudflare's bot rules can't be seen from outside. A robots.txt block is R14's job, not this one's.
export function checkCloudflare(check: AiAccessInput | null): FixResult {
  if (!check) return unchecked("R16", "no_domain");
  if (check.outcome === "unreachable") return unchecked("R16", "site_unreachable");
  if (check.cloudflare && check.crawlers.every((c) => c.allowed)) return fix("R16", { cloudflare: true });
  return ok("R16", { cloudflare: check.cloudflare });
}
