import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_ACTIVE_QUESTIONS,
  TEMPLATES,
  buildQuestions,
  expandTemplate,
  fillTemplate,
} from "@/lib/questions/templates";
import { DIETARY, IRVINE_PLACES, OCCASIONS } from "../../fixtures/irvine";
import {
  exampleRamenHouse,
  exampleRamenHousePicks,
  exampleRamenHouseQuestions,
} from "../../fixtures/example-ramen-house";

const uiMd = readFileSync(join(process.cwd(), "docs/UI.md"), "utf8");

// Table rows between a heading and the next heading or bullet list.
function tableRows(heading: string): string[][] {
  const section = uiMd.split(heading)[1].split(/\n(?:#|- )/)[0];
  return section
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .slice(2)
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
}

const REQUIRED = [
  "best ramen near Irvine Spectrum Center",
  "vegan-friendly ramen in Woodbridge",
  "best ramen in Irvine",
];

describe("question templates match docs/UI.md", () => {
  it("has the 20 templates verbatim, in order", () => {
    const rows = tableRows("## Question templates");
    expect(rows).toHaveLength(20);
    expect(TEMPLATES.map((t) => [t.short_form, t.long_form, t.origin])).toEqual(rows);
    expect(TEMPLATES.map((t) => t.sort)).toEqual(rows.map((_, i) => i + 1));
  });

  it("slots list every {slot} used in either form", () => {
    for (const t of TEMPLATES) {
      const used = [...`${t.short_form} ${t.long_form}`.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      expect([...t.slots].sort()).toEqual([...new Set(used)].sort());
    }
  });

  it("dietary and occasion options match docs/UI.md", () => {
    const list = (name: string) => uiMd.split(`- **{${name}}**: `)[1].split("\n")[0].split(", ");
    expect([...DIETARY]).toEqual(list("dietary"));
    expect([...OCCASIONS]).toEqual(list("occasion"));
  });
});

describe("Irvine places fixture matches docs/UI.md", () => {
  it("has every place with its kind", () => {
    const rows = tableRows("## Irvine places");
    expect(IRVINE_PLACES).toHaveLength(rows.length);
    rows.forEach(([cell, kind], i) => {
      const place = IRVINE_PLACES[i];
      expect(place.name).toBe(cell.replace(/ \(.*\)$/, ""));
      expect(place.kind).toBe(kind.split(" ")[0]);
    });
  });

  it("Eighteen Main lists its members (checked 11/4/26)", () => {
    const eighteen = IRVINE_PLACES.find((p) => p.name === "Eighteen Main")!;
    expect(eighteen.members).toEqual([
      "SOL Mexican Cocina",
      "KIT Coffee",
      "The Goldfinch",
      "Izakaya Osen",
      "The Trough",
      "Fat of the Land",
    ]);
    expect(eighteen.checked).toBe("2026-11-04");
  });
});

describe("filling templates for Example Ramen House", () => {
  const choice = {
    landmark: "Irvine Spectrum Center",
    area: "Woodbridge",
    dietary: "vegan",
    occasion: "date night",
  };

  it("fills every template with no {slot} left", () => {
    for (const t of TEMPLATES) {
      const q = fillTemplate(t, exampleRamenHouse, choice);
      expect(q.short_text).not.toMatch(/[{}]/);
      expect(q.long_text).not.toMatch(/[{}]/);
    }
  });

  it("fills slots with the business and the choice", () => {
    expect(fillTemplate(TEMPLATES[0], exampleRamenHouse, {})).toEqual({
      short_text: "best ramen in Irvine",
      long_text:
        "I'm in Irvine, CA with two friends tonight; where can we get really good ramen that isn't too expensive and has quick seating?",
    });
  });

  it("throws when a slot has no value", () => {
    expect(() => fillTemplate(TEMPLATES[1], exampleRamenHouse, {})).toThrow(/landmark/);
  });

  it("expands over every pick, and nothing when a slot has no picks", () => {
    const nearLandmark = TEMPLATES[1];
    expect(expandTemplate(nearLandmark, exampleRamenHouse, exampleRamenHousePicks)).toHaveLength(3);
    expect(expandTemplate(nearLandmark, exampleRamenHouse, { ...exampleRamenHousePicks, landmarks: [] })).toEqual([]);
  });

  it("uses fixed templates only for a matching cuisine and city", () => {
    const shorts = exampleRamenHouseQuestions.map((q) => q.short_text);
    expect(shorts).toContain("date night at Irvine Spectrum Center");
    expect(shorts).toContain("lunch near Irvine Business Complex");
    expect(shorts).not.toContain("best sushi in Irvine");
    const elsewhere = buildQuestions({ ...exampleRamenHouse, city: "Tustin" }, exampleRamenHousePicks);
    expect(elsewhere.some((q) => q.template_sort >= 11 && q.template_sort <= 20)).toBe(false);
  });
});

describe("Example Ramen House active questions", () => {
  const shorts = exampleRamenHouseQuestions.map((q) => q.short_text);

  it("generates more than the cap, so the cap is exercised", () => {
    const all = TEMPLATES.flatMap((t) => expandTemplate(t, exampleRamenHouse, exampleRamenHousePicks));
    expect(new Set(all.map((q) => q.short_text.toLowerCase())).size).toBe(27);
  });

  it("has exactly 25 questions, no duplicates, no unfilled slots", () => {
    expect(MAX_ACTIVE_QUESTIONS).toBe(25);
    expect(exampleRamenHouseQuestions).toHaveLength(25);
    expect(new Set(shorts.map((s) => s.toLowerCase())).size).toBe(25);
    expect(new Set(exampleRamenHouseQuestions.map((q) => q.long_text)).size).toBe(25);
    for (const q of exampleRamenHouseQuestions) {
      expect(q.short_text).not.toMatch(/[{}]/);
      expect(q.long_text).not.toMatch(/[{}]/);
    }
  });

  it("round-robin keeps the required questions inside the 25", () => {
    for (const required of REQUIRED) expect(shorts).toContain(required);
  });

  it("never returns more than 25 however many picks there are", () => {
    const places = (kind: string) => IRVINE_PLACES.filter((p) => p.kind === kind).map((p) => p.name);
    const everything = buildQuestions(exampleRamenHouse, {
      landmarks: places("landmark"),
      areas: places("area"),
      dietary: [...DIETARY],
      occasion: [...OCCASIONS],
    });
    expect(everything).toHaveLength(25);
  });
});
