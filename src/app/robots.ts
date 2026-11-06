import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site/origin";

// G6: every crawler may read the public site, the AI ones by name; the private areas are off-limits. /audit
// pages carry their own noindex. Previews (anything but production) disallow everything.
const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "PerplexityBot", "Google-Extended"];
const PRIVATE = ["/app", "/team", "/client", "/api", "/dev", "/admin", "/auth"];

export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV !== "production") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: ["*", ...AI_CRAWLERS].map((userAgent) => ({ userAgent, allow: "/", disallow: PRIVATE })),
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
