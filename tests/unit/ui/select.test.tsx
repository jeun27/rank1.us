import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Select } from "@/components/ui/Select";

// Founder fix (lead 17:09): one select. The native arrow is hidden and our 16px muted chevron sits at
// right-3 inside a fixed pr-10, vertically centred, so it never touches the control's curve.
describe("Select", () => {
  it("hides the native arrow and draws the ui/Icon chevron inside the right padding", () => {
    render(
      <Select aria-label="Location level" defaultValue="city" className="h-11 rounded-control">
        <option value="city">City</option>
        <option value="state">State</option>
      </Select>,
    );
    const select = screen.getByRole("combobox", { name: "Location level" });
    const cls = select.className.split(" ");
    for (const c of ["appearance-none", "pr-10", "rounded-control", "h-11"]) expect(cls).toContain(c);
    expect(select).toHaveValue("city");
    const icon = select.parentElement!.querySelector("[data-icon=chevronDown]")!;
    expect(icon).toHaveAttribute("aria-hidden", "true");
    for (const c of [
      "pointer-events-none",
      "absolute",
      "right-3",
      "top-1/2",
      "-translate-y-1/2",
      "size-4",
      "text-inkMuted",
    ])
      expect(icon.getAttribute("class")!.split(" ")).toContain(c);
  });
});
