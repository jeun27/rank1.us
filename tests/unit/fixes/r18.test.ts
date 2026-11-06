import { describe, expect, it } from "vitest";
import { checkJsEmpty } from "@/lib/fixes/r18-js-empty";
import { COPY } from "@/lib/fixes/types";
import { JS_EMPTY_WORDS } from "@/lib/site/ai-access";

const base = {
  domain: "example-ramen-house.test",
  crawlers: [],
  statusNormal: 200,
  statusGptbot: 200,
  cloudflare: false,
  pagesChecked: 1,
};

describe("R18 homepage needs JavaScript", () => {
  it(`fix under ${JS_EMPTY_WORDS} visible words with JavaScript off, with the lead's copy and the count as evidence`, () => {
    expect(checkJsEmpty({ ...base, outcome: "js_empty", visibleWords: 3 })).toEqual({
      rule_key: "R18",
      result: "fix",
      evidence: { visible_words: 3 },
      detail: COPY.R18,
    });
  });

  it("a crawler block doesn't hide a JS-empty page: R18 looks at the word count itself", () => {
    expect(checkJsEmpty({ ...base, outcome: "blocked", visibleWords: 0 }).result).toBe("fix");
  });

  it(`ok at ${JS_EMPTY_WORDS}+ words; unchecked with no site or an unreachable one`, () => {
    expect(checkJsEmpty({ ...base, outcome: "good", visibleWords: JS_EMPTY_WORDS }).result).toBe("ok");
    expect(checkJsEmpty(null)).toMatchObject({ result: "unchecked", evidence: { reason: "no_domain" } });
    expect(checkJsEmpty({ ...base, outcome: "unreachable", visibleWords: null })).toMatchObject({
      result: "unchecked",
      evidence: { reason: "site_unreachable" },
    });
  });
});
