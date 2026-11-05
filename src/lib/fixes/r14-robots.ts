import { robotsAllows, type RobotsState } from "@/lib/onboarding/read-site";
import { fix, ok, unchecked, type FixResult } from "./types";

// Search crawlers whose block is a fix; training/other bots are reported only (SCHEMA §5b R14).
export const FIX_BOTS = ["OAI-SearchBot", "PerplexityBot"] as const;
export const INFO_BOTS = ["GPTBot", "Google-Extended"] as const;
export const KEY_PATHS = ["/", "/menu"] as const;

const blockedPaths = (text: string, bot: string) => KEY_PATHS.filter((p) => !robotsAllows(text, p, bot));

export function checkRobots(robots: RobotsState): FixResult {
  if (robots.status === "error") return unchecked("R14", "robots_unreachable");
  const blocked = FIX_BOTS.map((bot) => ({ bot, paths: blockedPaths(robots.text, bot) })).filter((b) => b.paths.length);
  const info = INFO_BOTS.map((bot) => ({ bot, paths: blockedPaths(robots.text, bot) })).filter((b) => b.paths.length);
  const evidence = { robots: robots.status, blocked, info };
  if (!blocked.length) return ok("R14", evidence);
  const paths = KEY_PATHS.filter((p) => blocked.some((b) => b.paths.includes(p)));
  return fix("R14", evidence, { bots: blocked.map((b) => b.bot).join(", "), paths: paths.join(", ") });
}
