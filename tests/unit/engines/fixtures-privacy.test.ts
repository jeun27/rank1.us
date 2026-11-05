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
  it("links only to example.test, except its docs source", () => {
    const urls = [...new Set(read(file).match(/https?:\/\/[^"\s)\]]+/g) ?? [])];
    const other = urls.filter(
      (u) => !/^https:\/\/(www\.)?example-[a-z0-9-]+\.test\//.test(u) && !u.startsWith("https://docs.dataforseo.com/"),
    );
    expect(other).toEqual([]);
  });
});
