import type { Metadata } from "next";
import { gasPage } from "../params";
import { YoutubeView } from "./YoutubeView";

export const metadata: Metadata = { title: "G1 YouTube checklist", robots: { index: false } };
export default gasPage(YoutubeView);
