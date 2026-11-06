// Example data for the /dev/app connections states: invented locations and changes, no real accounts.
import type { HubProps } from "./ConnectionsHub";

const noop = async () => undefined;
export const exampleLocations = [
  { id: "locations/ex-1", name: "Example Ramen House, Irvine" },
  { id: "locations/ex-2", name: "Example Ramen House, Tustin" },
];

export const exampleHub = (over: Partial<HubProps> = {}): HubProps => ({
  businessId: "example-business",
  industry: "restaurant",
  connections: [],
  interest: [],
  changes: [],
  canConnect: true,
  returnTo: "/app/settings/connections",
  outcome: null,
  actions: { revoke: noop, notify: noop, pick: noop, entities: async () => exampleLocations },
  ...over,
});

export const exampleConnected: Partial<HubProps> = {
  connections: [
    { id: "ex-gbp", provider: "gbp", status: "connected", selected: [exampleLocations[0]] },
    { id: "ex-sc", provider: "search_console", status: "needs_reauth", selected: [] },
  ],
  interest: ["yelp"],
  changes: [
    { id: "ex-c1", connectionId: "ex-gbp", field: "regular_hours", at: "2026-11-04T18:00:00Z" },
    { id: "ex-c2", connectionId: "ex-gbp", field: "description", at: "2026-11-02T16:30:00Z" },
  ],
};
