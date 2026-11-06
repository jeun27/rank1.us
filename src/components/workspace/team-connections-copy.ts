// C-c strings: COPY.md "Connections (lead, 2026-11-06)", C-c rows, signed off by the lead (2026-11-06).
export const teamConnectionsCopy = {
  title: "Connections",
  ready: (business: string) => `${business} is ready for GAS`,
  connectedAgo: (connections: string, age: string) => `${connections} connected ${age} ago.`,
  start: "Start on the fix list",
  dismiss: "Dismiss",
  reconnect: (connection: string) => `Ask the client to reconnect ${connection}`,
  choose: (what: string) => `Ask the client to choose their ${what}`,
  // What each picker chooses (the hub's picker labels, as nouns).
  pickNoun: { gbp: "locations", search_console: "sites", ga4: "properties" } as Record<string, string>,
  interest: (connectors: string) => `Asked to hear about ${connectors}`,
  changes: "Changes",
  before: "Before",
  after: "After",
  byTeam: "by Rank1 team",
  by: (name: string) => `by ${name}`,
  failed: "We couldn't do that. Try again.",
};
