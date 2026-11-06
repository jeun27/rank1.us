import "server-only";
import { connectionsEnabled } from "@/lib/connections/service";

// UI.md 4b Report partial (QA #89 F1): GA4 isn't connected yet, so the report UI hides the GA4 section.
// 'Connect GA4' points at the Connections hub, and only exists while that hub does (never a dead link).
export const ga4ConnectHref = (): string | null => (connectionsEnabled() ? "/app/settings/connections" : null);
