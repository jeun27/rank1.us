import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ClientsPanel } from "@/components/workspace/ClientsPanel";

const users = [{ user_id: "u1", email: "owner@example.test", added_at: "2026-11-05T12:00:00Z", signed_in: true }];
const actions = (over = {}) => ({
  invite: vi.fn(async () => ({ status: "invited" as const })),
  remove: vi.fn(async () => undefined),
  setVisible: vi.fn(async () => undefined),
  ...over,
});

// Step 12: the team's Clients tab for one DFY client.
describe("ClientsPanel", () => {
  it("lists client users with Remove access; Remove calls the action for that user", async () => {
    const a = actions();
    render(<ClientsPanel users={users} fixListVisible={false} actions={a} />);
    const list = screen.getByRole("list", { name: "Clients" });
    expect(within(list).getByText("owner@example.test")).toBeInTheDocument();
    await userEvent.click(within(list).getByRole("button", { name: "Remove access" }));
    expect(a.remove).toHaveBeenCalledWith("u1");
  });

  it.each([
    ["invited", "Invite sent to new@example.test."],
    ["existing_account", "This email already has a Rank1 account."],
    ["already_invited", "Already invited."],
  ] as const)("Invite client: %s → %s", async (status, message) => {
    const a = actions({ invite: vi.fn(async () => ({ status })) });
    render(<ClientsPanel users={[]} fixListVisible={false} actions={a} />);
    expect(screen.getByRole("heading", { name: "Invite client" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Email"), "new@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Send invite" }));
    expect(a.invite).toHaveBeenCalledWith("new@example.test");
    expect(await screen.findByRole("status")).toHaveTextContent(message);
  });

  it("invalid email: the forms' email error; error: the retryable banner", async () => {
    const a = actions({ invite: vi.fn(async () => ({ status: "invalid_email" as const })) });
    const { unmount } = render(<ClientsPanel users={[]} fixListVisible={false} actions={a} />);
    await userEvent.type(screen.getByLabelText("Email"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Send invite" }));
    expect(await screen.findByText("Add a valid email, like you@ramenhouse.com")).toBeInTheDocument();
    unmount();
    render(
      <ClientsPanel
        users={[]}
        fixListVisible={false}
        actions={actions({ invite: vi.fn(async () => ({ status: "error" as const })) })}
      />,
    );
    await userEvent.type(screen.getByLabelText("Email"), "new@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Send invite" }));
    expect(await screen.findByText("That didn't send. Try again in a minute.")).toBeInTheDocument();
  });

  it("Show fix list to client: a checkbox that saves, and reverts with the banner on failure", async () => {
    const a = actions({ setVisible: vi.fn(async () => ({ error: "failed" })) });
    render(<ClientsPanel users={users} fixListVisible={false} actions={a} />);
    const box = screen.getByRole("checkbox", { name: "Show fix list to client" });
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(a.setVisible).toHaveBeenCalledWith(true);
    expect(await screen.findByText("We couldn't save that. Try again.")).toBeInTheDocument();
    expect(box).not.toBeChecked();
  });

  it("COPY.md has the lead's Client invites strings", () => {
    const copy = readFileSync("docs/COPY.md", "utf8");
    expect(copy).toMatch(/## Client invites \(lead, 2026-11-05\)/);
    for (const s of [
      "Invite client",
      "Email",
      "Send invite",
      "Invite sent to {email}.",
      "This email already has a Rank1 account.",
      "Already invited.",
      "Remove access",
      "Clients",
      "Show fix list to client",
      "Nothing tracked yet.",
    ])
      expect(copy).toContain(`"${s}"`);
  });
});
