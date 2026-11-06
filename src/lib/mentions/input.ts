// The server actions' check of a decision (the RPC checks again: http(s), ≤ 2000 characters).
export const MENTION_STATUSES = ["added", "dismissed", null] as const;
export type MentionStatus = (typeof MENTION_STATUSES)[number];

export const validMentionDecision = (url: unknown, status: unknown): status is MentionStatus =>
  typeof url === "string" &&
  url.length <= 2000 &&
  /^https?:\/\//i.test(url) &&
  MENTION_STATUSES.includes(status as MentionStatus);
