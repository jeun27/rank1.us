import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadShell } from "@/components/app/load";
import { Page } from "@/components/app/Page";
import { narrativeCopy as c } from "@/components/narrative/copy";
import { WordsEditor } from "@/components/narrative/WordsEditor";
import { loadNarrative } from "@/lib/narrative/service";
import { saveNarrativeWordsAction } from "./actions";

export const metadata: Metadata = { title: "How should AI describe you? - Rank1", robots: { index: false } };

// G4 Settings (lead Q4: the words are setup). Behind ENABLE_NARRATIVE (proxy 404). The no-clash and too-few
// states live here, not on the Dashboard (lead Q2).
export default async function NarrativeSettingsPage() {
  const { db, business } = await loadShell();
  if (!business) redirect("/app");
  const view = await loadNarrative(db, business.id);
  if (view === "disabled" || !view) redirect("/app");
  const r = view.result;
  return (
    <Page title={c.settingsTitle}>
      {r?.tooFew && <p className="text-ui">{c.tooFew}</p>}
      {r && !r.tooFew && r.clashes === 0 && view.words.avoid.length > 0 && <p className="text-ui">{c.noClash}</p>}
      <WordsEditor words={view.words} result={r && !r.tooFew ? r : null} save={saveNarrativeWordsAction} />
    </Page>
  );
}
