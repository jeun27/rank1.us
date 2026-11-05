import { admin, newUser } from "./auth";

const must = <T>(r: { data: T; error: unknown }): NonNullable<T> => {
  if (r.error) throw r.error;
  return r.data as NonNullable<T>;
};

// A workspace with one active business (DFY or self-serve) owned by a fresh user. /team shows the
// workspace only when at least one DFY client exists, so team tests seed one.
export async function seedBusiness(service: "dfy" | "self_serve", name: string) {
  const owner = await newUser(`owner-${service}`);
  const ws = must(
    await admin()
      .from("workspaces")
      .insert({ name: "Example Workspace", owner_id: owner.id, subscription_status: "active", seats_quantity: 1 })
      .select("id")
      .single(),
  );
  return must(
    await admin()
      .from("businesses")
      .insert({ workspace_id: ws.id, name, service, domain: "exampleramen.test" })
      .select("id")
      .single(),
  ).id;
}
