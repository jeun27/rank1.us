import { listEntitiesAction, notifyAction, pickEntitiesAction, revokeConnectionAction } from "./actions";
import type { HubActions } from "./ConnectionsHub";

// The server actions as the hub's actions; notify is bound to the page's business.
export const hubActions = (businessId: string): HubActions => ({
  revoke: revokeConnectionAction,
  entities: listEntitiesAction,
  pick: pickEntitiesAction,
  notify: notifyAction.bind(null, businessId),
});
