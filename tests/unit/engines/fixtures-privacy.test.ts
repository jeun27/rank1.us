import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The repo is public: engine fixtures hold no phones, emails or addresses, and synthetic files only
// example.test links.
const dir = join(process.cwd(), "tests", "fixtures", "engines");
const files = readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".json"));
const synthetic = files.filter((f) => f.split("/").pop()!.startsWith("synthetic-"));
const read = (file: string) => readFileSync(join(dir, file), "utf8");

describe.each(files)("fixture %s", (file) => {
  it("has no phone numbers, emails or filled address/phone fields", () => {
    const text = read(file);
    expect(text.match(/\+1\d{10}|\(\d{3}\) ?\d{3}-\d{4}|\b\d{3}-\d{3}-\d{4}\b/g)).toBeNull();
    expect(text.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/gi)).toBeNull();
    expect(text.match(/"(phone|address|email)": "[^"]+"/g)).toBeNull();
  });
});

describe.each(synthetic)("synthetic fixture %s", (file) => {
  // The docs URL may appear only in the _synthetic note; every link in the data is example-*.test.
  it("links only to example-*.test outside its _synthetic note", () => {
    const { _synthetic: note, ...data } = JSON.parse(read(file));
    expect(typeof note).toBe("string");
    const urls = [...new Set(JSON.stringify(data).match(/https?:\/\/[^"\s)\]\\]+/g) ?? [])];
    expect(urls.filter((u) => !/^https:\/\/(www\.)?example-[a-z0-9-]+\.test\//.test(u))).toEqual([]);
    expect([...(note as string).matchAll(/https?:\/\/[^\s)]+/g)].every((m) => m[0].startsWith("https://docs."))).toBe(
      true,
    );
  });

  it("names only Example brands in title/name fields", () => {
    const names = [...read(file).matchAll(/"(title|name|source_name)": "([^"]*)"/g)].map((m) => m[2]);
    expect(names.filter((n) => !/^Example\b/.test(n))).toEqual([]);
  });
});
