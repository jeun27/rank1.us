import { EmptyState, type FirstCheck } from "@/components/ui/EmptyState";
import { appCopy as c } from "./copy";

// X25: before the first check. Running: nothing to do but wait. Not queued yet: it runs Monday, and
// reviewing the questions is the one useful step meanwhile.
export function FirstCheckEmpty({ state }: { state: FirstCheck }) {
  return state === "running" ? (
    <EmptyState message={c.firstRunning} />
  ) : (
    <EmptyState message={c.firstMonday} action={{ label: c.reviewQuestions, href: "/app/questions" }} />
  );
}
