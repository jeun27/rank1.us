import type { Metadata } from "next";
import { gasPage } from "../params";
import { NarrativeView } from "./NarrativeView";

export const metadata: Metadata = { title: "G4 How AI describes you", robots: { index: false } };
export default gasPage(NarrativeView);
