"use client";
import { createContext, useContext } from "react";
import type { DoneView, FixView } from "@/components/fixes/FixList";
import type { LocalCompetitor } from "@/lib/onboarding/types";
import type { InviteStatus } from "@/lib/queries/clients";
import type { QueueRow } from "@/lib/workspace/queue";
import type { FixStatus } from "@/lib/queries/fixes";
import type { CompetitorInput } from "@/lib/queries/shell";
import type { ContextInput } from "@/lib/workspace/context";
import type { ClientUserView } from "./ClientsPanel";

type Result = Promise<{ error: string } | undefined | void>;

// What the team workspace adds on top of #11's read-only view: the client switcher, the stored-data
// brief, the Fix list and competitor writes. input null = Example data (the brief is buildBrief).
export type TeamExtras = {
  businesses: { id: string; name: string }[];
  businessId: string;
  formAction: string;
  hidden?: Record<string, string>;
  input: ContextInput | null;
  fixes: {
    ranked: FixView[];
    tidyUps: FixView[];
    done?: DoneView[];
    unchecked: { rule_key: string; title: string }[];
    noDomain: boolean;
  };
  // Maps suggestions cost a maps_lookup token: fetched only when the Competitors view opens.
  loadSuggestions: (businessId: string) => Promise<LocalCompetitor[]>;
  // Step 12: the client users of this DFY client and the fix-list toggle (team only). null in galleries without it.
  clients: { users: ClientUserView[]; fixListVisible: boolean } | null;
  // X5: every DFY client, sorted by what needs the team first; the default document when present.
  queue?: QueueRow[];
  // Open on the queue: /team with no client picked (a queue row opens /team?b= on that client).
  openQueue?: boolean;
  actions: {
    status: (businessId: string, fixId: string, status: FixStatus) => Result;
    add: (businessId: string, c: CompetitorInput) => Result;
    dismiss: (businessId: string, c: CompetitorInput) => Result;
    invite: (businessId: string, email: string) => Promise<{ status: InviteStatus }>;
    removeClient: (businessId: string, userId: string) => Result;
    setFixListVisible: (businessId: string, visible: boolean) => Result;
  };
};

const Team = createContext<TeamExtras | null>(null);
export const TeamProvider = Team.Provider;
export const useTeam = () => useContext(Team);
