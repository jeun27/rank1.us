import { BusinessSwitcher } from "@/components/billing/BusinessSwitcher";
import { getBillingState, listMyBusinesses } from "@/lib/queries/billing";
import { getCurrentBusiness, listRunSummaries } from "@/lib/queries/shell";
import { createClient } from "@/lib/supabase/server";
import { addBusinessAction, removeBusinessAction, seatsAction, selectBusinessAction } from "./billing/actions";
import { selectedBusinessId } from "./current";

const CHECKING = new Set(["active", "trialing"]);

// UI.md 4b "Business switcher" in the /app header. Visibility per business is its latest complete/partial
// run; the dot is moss while weekly checks run (active/trialing), brick when they're paused.
export async function HeaderSwitcher() {
  const db = await createClient();
  const [businesses, billing, current] = await Promise.all([
    listMyBusinesses(db),
    getBillingState(db),
    getCurrentBusiness(db, await selectedBusinessId()),
  ]);
  if (!businesses.length || !current) return null;
  const latest = await Promise.all(
    businesses.map((b) => listRunSummaries(db, b.id, 1, ["complete", "partial"]).then((r) => r[0] ?? null)),
  );
  const checking = Boolean(billing?.status && CHECKING.has(billing.status));
  return (
    <BusinessSwitcher
      businesses={businesses.map((b, i) => ({
        id: b.id,
        name: b.name,
        city: b.city,
        visibility: latest[i]?.visibility ?? null,
        active: checking,
      }))}
      currentId={current.id}
      // What Stripe bills; before checkout (0) the active businesses, so "from n x $99" stays true (backend).
      seats={billing?.seats || billing?.activeCount || businesses.length}
      periodEnd={billing?.nextInvoiceAt ?? null}
      actions={{
        select: selectBusinessAction,
        add: addBusinessAction,
        remove: removeBusinessAction,
        seats: seatsAction,
      }}
    />
  );
}
