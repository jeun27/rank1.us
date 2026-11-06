import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { LocationSelect } from "@/components/app/LocationSelect";
import { FixList } from "@/components/fixes/FixList";
import { exampleFixes } from "@/components/fixes/example-data";
import { PillField } from "@/components/forms/PillField";
import { DomainField } from "@/components/ui/DomainField";

// R2 (lead O1, docs/UI.md type table): form fields stay 16px below md so iPhone Safari doesn't zoom on focus.
// One unlayered rule in globals.css covers every native input, select and textarea; these tests check the
// rule exists and that no shared field opts out of it (an !important size or an inline font-size would win).
const css = readFileSync("src/app/globals.css", "utf8");

const fields: [string, ReactElement][] = [
  [
    "DomainField",
    <DomainField
      key="d"
      label="Your domain"
      placeholder="yourbusiness.com"
      buttonLabel="Get my free audit"
      loadingLabel="Checking…"
    />,
  ],
  ["PillField", <PillField key="p" label="Email" name="email" />],
  [
    "LocationSelect",
    <LocationSelect
      key="l"
      locations={[{ id: "l1", label: "Irvine, CA", level: "city" } as never]}
      value={undefined}
    />,
  ],
  [
    "FixList Status",
    <FixList key="f" ranked={exampleFixes} tidyUps={[]} unchecked={[]} noDomain={false} canWrite onStatus={vi.fn()} />,
  ],
];

describe("form fields stay 16px below md (R2)", () => {
  it("globals.css has the unlayered rule for input, select and textarea", () => {
    const rule = css.match(/@media \(width < 48rem\) \{\s*input,\s*select,\s*textarea \{ font-size: 16px; \}\s*\}/);
    expect(rule).not.toBeNull();
    // Unlayered: not inside an @layer block, so it beats the text-ui utility.
    const before = css.slice(0, rule!.index);
    expect((before.match(/@layer[^{]*\{/g) ?? []).length).toBe(0);
  });

  it.each(fields)("%s renders native controls that don't override the size", (_, el) => {
    const { container } = render(el);
    const controls = [...container.querySelectorAll("input:not([type=hidden]), select, textarea")] as HTMLElement[];
    expect(controls.length).toBeGreaterThan(0);
    for (const c of controls) {
      expect(c.style.fontSize).toBe("");
      expect(c.className).not.toMatch(/(^|\s)!text-|text-\S+!(\s|$)/);
    }
  });
});
