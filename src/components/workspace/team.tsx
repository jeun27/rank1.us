"use client";
import { createContext, useContext } from "react";
import type { FixView } from "@/components/fixes/FixList";
import type { LocalCompetitor } from "@/lib/onboarding/types";
import type { FixStatus } from "@/lib/queries/fixes";
import type { CompetitorInput } from "@/lib/queries/shell";
import type { ContextInput } from "@/lib/workspace/context";

type Result = Promise<{ error: string } | undefined | void>;

// What the team workspace adds on top of #11's read-only view: the client switcher, the stored-data
// brief, the Fix list and competitor writes. input null = Example data (the brief is buildBrief).
export type TeamExtras = {
  businesses: { id: string; name: string }[];
  businessId: string;
  formAction: string;
  hidden?: Record<string, string>;
  input: ContextInput | null;
  fixes: { ranked: FixView[]; tidyUps: FixView[]; unchecked: { rule_key: string; title: string }[]; noDomain: boolean };
  // Maps suggestions cost a maps_lookup token: fetched only when the Competitors view opens.
  loadSuggestions: (businessId: string) => Promise<LocalCompetitor[]>;
  actions: {
    status: (businessId: string, fixId: string, status: FixStatus) => Result;
    add: (businessId: string, c: CompetitorInput) => Result;
    dismiss: (businessId: string, c: CompetitorInput) => Result;
  };
};

const Team = createContext<TeamExtras | null>(null);
export const TeamProvider = Team.Provider;
export const useTeam = () => useContext(Team);
