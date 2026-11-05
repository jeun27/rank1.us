// Citation domain → domain_categories.category. Rule lists are ours (UNVERIFIED): see PROGRESS.md.
export type Category = "reddit" | "youtube" | "social" | "review_directory" | "news_blog" | "other";

const REDDIT = ["reddit.com", "redd.it"];
const YOUTUBE = ["youtube.com", "youtu.be"];
const SOCIAL = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "tiktok.com",
  "x.com",
  "twitter.com",
  "threads.net",
  "linkedin.com",
  "pinterest.com",
  "snapchat.com",
];
// User-review and listing sites (fix rules R6/R7 territory), including delivery apps.
const REVIEW = [
  "yelp.com",
  "tripadvisor.com",
  "opentable.com",
  "resy.com",
  "maps.google.com",
  "maps.app.goo.gl",
  "doordash.com",
  "ubereats.com",
  "grubhub.com",
  "postmates.com",
  "seamless.com",
  "foursquare.com",
  "yellowpages.com",
  "zomato.com",
];
// Editorial guides and outlets (fix rule R12 "best of" territory), plus blog platforms.
const NEWS = [
  "eater.com",
  "theinfatuation.com",
  "guide.michelin.com",
  "zagat.com",
  "ocregister.com",
  "latimes.com",
  "nytimes.com",
  "ocweekly.com",
  "timeout.com",
  "sfgate.com",
  "washingtonpost.com",
  "cnn.com",
  "usatoday.com",
  "medium.com",
  "substack.com",
  "wordpress.com",
  "blogspot.com",
  "tumblr.com",
];

export const hostOf = (urlOrDomain: string) => {
  try {
    const u = new URL(/^https?:\/\//i.test(urlOrDomain) ? urlOrDomain : `https://${urlOrDomain}`);
    return { host: u.hostname.toLowerCase().replace(/^(www|m)\./, ""), path: u.pathname.toLowerCase() };
  } catch {
    return { host: urlOrDomain.toLowerCase().replace(/^(www|m)\./, ""), path: "" };
  }
};

const under = (host: string, list: string[]) => list.some((d) => host === d || host.endsWith(`.${d}`));

// A manual domain_categories row wins over the rules.
export function categorize(urlOrDomain: string, overrides: Record<string, Category> = {}): Category {
  const { host, path } = hostOf(urlOrDomain);
  const manual = Object.entries(overrides).find(([d]) => host === d || host.endsWith(`.${d}`));
  if (manual) return manual[1];
  if (under(host, REDDIT)) return "reddit";
  if (under(host, YOUTUBE)) return "youtube";
  if (under(host, SOCIAL)) return "social";
  if (under(host, REVIEW) || (/^google\.[a-z.]+$/.test(host) && path.startsWith("/maps"))) return "review_directory";
  if (under(host, NEWS) || /^(blog|blogs|news)\./.test(host) || /(^|\/)blog(s)?(\/|$)/.test(path)) return "news_blog";
  return "other";
}
