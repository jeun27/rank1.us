// The public site's origin for absolute URLs (robots.txt, sitemap.xml): NEXT_PUBLIC_SITE_URL when it is an
// https URL, else https://rank1.us.
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  try {
    const u = new URL(env.NEXT_PUBLIC_SITE_URL ?? "");
    if (u.protocol === "https:") return u.origin;
  } catch {}
  return "https://rank1.us";
}
