import "server-only";
import type { DbClient } from "./client";

// DFY client invites (Step 12). Server only. Never log or echo client emails: status codes only.

export type InviteStatus = "invited" | "existing_account" | "already_invited" | "invalid_email";

// Sends the Supabase Auth invite email and returns the new user's id.
export type InviteFn = (email: string, redirectTo: string) => Promise<{ userId: string }>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const adminInvite =
  (serviceDb: DbClient): InviteFn =>
  async (email, redirectTo) => {
    const { data, error } = await serviceDb.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (error) throw new Error(`Invite failed (${error.status ?? "error"})`);
    return { userId: data.user.id };
  };

// Service client only, after the server action checked the caller is team and the business is DFY.
// An email with any Rank1 account is refused (one business per client user in v1), so an existing
// account never changes. Only a new email gets the invite, then the dfy_client role + membership.
export async function inviteClient(
  serviceDb: DbClient,
  { email, businessId }: { email: string; businessId: string },
  invite: InviteFn = adminInvite(serviceDb),
): Promise<{ status: InviteStatus }> {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL.test(normalized) || normalized.length > 254) return { status: "invalid_email" };

  const { data: state, error } = await serviceDb.rpc("client_invite_status", {
    p_email: normalized,
    p_business_id: businessId,
  });
  if (error) throw error;
  if (state === "existing_account") return { status: "existing_account" };
  if (state === "already_client") return { status: "already_invited" };

  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) throw new Error("NEXT_PUBLIC_SITE_URL is not set");
  const { userId } = await invite(normalized, `${site.replace(/\/$/, "")}/auth/callback`);
  const { error: grantError } = await serviceDb.rpc("grant_dfy_client", {
    p_user_id: userId,
    p_business_id: businessId,
  });
  if (grantError) throw grantError;
  return { status: "invited" };
}

// Service client only, after the team + DFY check. Removes the client's membership (the role stays).
// Returns false when the user wasn't a client member of that business.
export async function removeClient(
  serviceDb: DbClient,
  { userId, businessId }: { userId: string; businessId: string },
): Promise<boolean> {
  const { data, error } = await serviceDb.rpc("revoke_dfy_client", { p_user_id: userId, p_business_id: businessId });
  if (error) throw error;
  return data;
}

export type ClientUser = { user_id: string; email: string; added_at: string; signed_in: boolean };

// Team only (the caller's client): a DFY business's client users. 42501 for anyone else.
export async function listClientUsers(db: DbClient, businessId: string): Promise<ClientUser[]> {
  const { data, error } = await db.rpc("list_client_users", { p_business_id: businessId });
  if (error) throw error;
  return data ?? [];
}

// Team only (the caller's client): show or hide the fix list to the business's clients. 42501 otherwise.
export async function setFixListVisible(db: DbClient, businessId: string, visible: boolean): Promise<void> {
  const { error } = await db.rpc("set_fix_list_visible", { p_business_id: businessId, p_visible: visible });
  if (error) throw error;
}
