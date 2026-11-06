import { narrativeCopy as c } from "./copy";
import type { NarrativeView } from "@/lib/narrative/service";
import { WordsEditor, type SaveWords } from "./WordsEditor";

// G4's words with the Settings-only lines (lead Q2: no-clash and too-few live here, not on the Dashboard).
// /app Settings and the team's "How AI describes {Business}" document (C-c D3).
export function NarrativeSettings({ view, save }: { view: NarrativeView; save: SaveWords }) {
  const r = view.result;
  return (
    <>
      {r?.tooFew && <p className="text-ui">{c.tooFew}</p>}
      {r && !r.tooFew && r.clashes === 0 && view.words.avoid.length > 0 && <p className="text-ui">{c.noClash}</p>}
      <WordsEditor words={view.words} result={r && !r.tooFew ? r : null} save={save} />
    </>
  );
}
