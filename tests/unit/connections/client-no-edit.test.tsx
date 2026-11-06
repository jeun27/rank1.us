import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConnectionsHub } from "@/components/connections/ConnectionsHub";
import { exampleConnected, exampleHub } from "@/components/connections/example-data";

// C-c PR 2 (lead D2): a dfy_client never sees edit controls. The client's hub (/client/settings/connections)
// has no Business Profile editor, preview or apply: editing lives only in the team's Connections document.
describe("the client's hub", () => {
  it("has no edit, preview or apply controls", () => {
    render(<ConnectionsHub {...exampleHub({ ...exampleConnected, returnTo: "/client/settings/connections" })} />);
    for (const name of [/edit business profile/i, /preview changes/i, /^apply$/i])
      expect(screen.queryByRole("button", { name })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
