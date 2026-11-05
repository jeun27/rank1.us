import { Placeholder } from "@/components/auth/Placeholder";

// /team with no active DFY client (lead copy). Creating clients stays the Step 5 path, so no link.
export function NoClients() {
  return (
    <Placeholder title="Dashboard">
      <p className="text-body-lg">No clients yet.</p>
    </Placeholder>
  );
}
