import { describe, expect, it } from "vitest";
import { categorize } from "@/lib/runs/categorize";
import { normalizeUrl, toStoredCitations } from "@/lib/runs/citations";

describe("categorize", () => {
  it.each([
    ["https://www.reddit.com/r/irvine/comments/x", "reddit"],
    ["https://old.reddit.com/r/orangecounty", "reddit"],
    ["https://youtu.be/abc", "youtube"],
    ["https://m.youtube.com/watch?v=1", "youtube"],
    ["https://www.instagram.com/example", "social"],
    ["https://x.com/example", "social"],
    ["https://www.tiktok.com/@example", "social"],
    ["https://www.yelp.com/biz/example", "review_directory"],
    ["https://www.tripadvisor.com/Restaurant_Review", "review_directory"],
    ["https://www.opentable.com/r/example", "review_directory"],
    ["https://resy.com/cities/oc/example", "review_directory"],
    ["https://www.google.com/maps/place/example", "review_directory"],
    ["https://maps.google.com/?cid=1", "review_directory"],
    ["https://www.doordash.com/store/example", "review_directory"],
    ["https://la.eater.com/maps/best-ramen", "news_blog"],
    ["https://www.theinfatuation.com/los-angeles", "news_blog"],
    ["https://guide.michelin.com/us/en/california", "news_blog"],
    ["https://www.ocregister.com/2026/10/01/food", "news_blog"],
    ["https://example-s1.test/blog/best-ramen", "news_blog"],
    ["https://blog.example-s2.test/post", "news_blog"],
    ["https://someone.substack.com/p/ramen", "news_blog"],
    ["https://www.google.com/search?q=ramen", "other"],
    ["https://example-reviews.test/irvine", "other"],
    ["https://notyelp.com/biz", "other"],
  ])("%s → %s", (url, cat) => {
    expect(categorize(url)).toBe(cat);
  });

  it("a manual override wins, for the domain and its subdomains", () => {
    expect(categorize("https://www.yelp.com/biz/x", { "yelp.com": "other" })).toBe("other");
    expect(categorize("https://blog.example-s2.test/post", { "example-s2.test": "review_directory" })).toBe(
      "review_directory",
    );
  });
});

describe("citation dedupe", () => {
  it("normalizeUrl: lowercase host, no trailing slash, no utm_*, no #fragment", () => {
    expect(normalizeUrl("https://Example-S1.TEST/Menu/?utm_source=chatgpt.com&a=1#:~:text=ramen")).toBe(
      "https://example-s1.test/Menu?a=1",
    );
    expect(normalizeUrl("https://example-s1.test/")).toBe("https://example-s1.test");
  });

  it("keeps the first of each normalized URL and renumbers positions in engine order", () => {
    const out = toStoredCitations([
      { url: "https://example-s1.test/a?utm_source=x", domain: "example-s1.test", title: "A", position: 1 },
      { url: "https://www.yelp.com/biz/example", domain: "www.yelp.com", position: 2 },
      { url: "https://EXAMPLE-S1.test/a/", domain: "example-s1.test", title: "A again", position: 3 },
      { url: "https://example-s1.test/a#frag", domain: "example-s1.test", position: 4 },
      { url: "https://example-s3.test/blog/b", domain: "example-s3.test", title: "B", position: 5 },
    ]);
    expect(out).toEqual([
      {
        url: "https://example-s1.test/a?utm_source=x",
        domain: "example-s1.test",
        title: "A",
        position: 1,
        category: "other",
      },
      {
        url: "https://www.yelp.com/biz/example",
        domain: "www.yelp.com",
        title: null,
        position: 2,
        category: "review_directory",
      },
      {
        url: "https://example-s3.test/blog/b",
        domain: "example-s3.test",
        title: "B",
        position: 3,
        category: "news_blog",
      },
    ]);
  });
});
