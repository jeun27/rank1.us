import "server-only";
import type { DbClient } from "@/lib/queries/client";

export const YOUTUBE_RULES = ["R19", "R20", "R21"] as const;
export type YoutubeRule = (typeof YOUTUBE_RULES)[number];
export type FixVideo = { id: string; title: string; url: string };

// The business's one YouTube keyword: its cuisine (data-pipeline's G1 rule), or null.
export async function cuisineOf(db: DbClient, businessId: string): Promise<string | null> {
  const { data, error } = await db.from("businesses").select("cuisine").eq("id", businessId).maybeSingle();
  if (error) throw error;
  return (data?.cuisine as string | null | undefined)?.trim() || null;
}

const isVideo = (v: unknown): v is FixVideo =>
  !!v &&
  typeof v === "object" &&
  ["id", "title", "url"].every((k) => typeof (v as Record<string, unknown>)[k] === "string");

// G1 (#150 review S1): the Fix list renders from what the weekly pass stored, never a live YouTube read.
// Each open R19–R21 fix's evidence lists the videos failing its one check ({ videos: [{id, title, url}] }).
export async function loadYoutubeFixVideos(
  db: DbClient,
  businessId: string,
  openRules: string[],
  env: Record<string, string | undefined> = process.env,
): Promise<{ keyword: string | null; byRule: Partial<Record<YoutubeRule, FixVideo[]>> } | null> {
  const rules = YOUTUBE_RULES.filter((r) => openRules.includes(r));
  if (env.ENABLE_CONNECTIONS !== "true" || !rules.length) return null;
  const [fixes, keyword] = await Promise.all([
    db
      .from("fixes")
      .select("id, rule_key, evidence")
      .eq("business_id", businessId)
      .in("rule_key", rules)
      .in("status", ["todo", "doing"]),
    cuisineOf(db, businessId),
  ]);
  if (fixes.error) throw fixes.error;
  const byRule: Partial<Record<YoutubeRule, FixVideo[]>> = {};
  for (const f of (fixes.data ?? []) as { rule_key: string; evidence: unknown }[]) {
    const videos = (f.evidence as { videos?: unknown } | null)?.videos;
    if (Array.isArray(videos) && videos.some(isVideo)) byRule[f.rule_key as YoutubeRule] = videos.filter(isVideo);
  }
  return { keyword, byRule };
}
