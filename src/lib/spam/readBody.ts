// JSON object body, or null for anything else (bad JSON, arrays, over 20 KB).
export async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  const raw = await req.text().catch(() => "");
  if (raw.length > 20_000) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
