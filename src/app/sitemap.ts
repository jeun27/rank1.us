import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site/origin";

// G6: the public pages only. /signin isn't content, and /audit/<token> links are private (noindex).
const PAGES = ["/", "/contact", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrl();
  return PAGES.map((p) => ({ url: `${origin}${p}` }));
}
