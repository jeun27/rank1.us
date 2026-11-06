import type { Metadata } from "next";
import { gasPage } from "../params";
import { MentionsView } from "./MentionsView";

export const metadata: Metadata = { title: "G7 Mention targets", robots: { index: false } };
export default gasPage(MentionsView);
