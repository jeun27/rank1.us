import type { Metadata } from "next";
import { gasPage } from "../params";
import { FixesView } from "./FixesView";

export const metadata: Metadata = { title: "G5 Fix list by pillar", robots: { index: false } };
export default gasPage(FixesView);
