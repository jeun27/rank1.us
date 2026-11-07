import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage from "@/app/privacy/page";

// Google OAuth verification (founder OK 2026-11-07): /privacy has a Google user data section with each scope,
// the use, storage, what we never do, and Google's exact Limited Use sentence linking the policy.
const POLICY = "https://developers.google.com/terms/api-services-user-data-policy";
// Google's sentence, word for word (lead, 2026-11-07).
const LIMITED_USE =
  "Rank1's use and transfer to any other app of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements.";
const text = () => document.body.textContent!.replace(/\s+/g, " ");

describe("/privacy: Google user data", () => {
  it("the Limited Use sentence, word for word, with the policy link", () => {
    render(<PrivacyPage />);
    expect(text()).toContain(LIMITED_USE);
    expect(screen.getByRole("link", { name: "Google API Services User Data Policy" })).toHaveAttribute("href", POLICY);
  });

  it("each scope, the use, storage and what we never do", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 2, name: "Google user data" })).toBeInTheDocument();
    for (const s of ["business.manage", "webmasters.readonly", "analytics.readonly", "youtube.readonly"])
      expect(text()).toContain(`the ${s} scope`);
    expect(text()).toContain("your Google account email and name");
    expect(text()).toContain("only to show you your own business's visibility and fixes");
    expect(text()).toContain("stored encrypted");
    expect(screen.getByRole("link", { name: "Google Account permissions" })).toHaveAttribute(
      "href",
      "https://myaccount.google.com/permissions",
    );
    expect(text()).toContain("We never sell your Google data, use it for ads, or use it to train AI models.");
  });

  it("last updated 2026-11-07, and the strings are in COPY.md", () => {
    render(<PrivacyPage />);
    expect(document.querySelector("time")).toHaveAttribute("datetime", "2026-11-07");
    const copy = readFileSync("docs/COPY.md", "utf8");
    expect(copy).toContain(LIMITED_USE);
    expect(copy).toContain("## Privacy: Google user data");
  });
});
