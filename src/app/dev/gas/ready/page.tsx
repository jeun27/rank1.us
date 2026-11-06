import type { Metadata } from "next";
import { gasPage } from "../params";
import { ReadyView } from "./ReadyView";

export const metadata: Metadata = { title: "G3 Ready for GAS", robots: { index: false } };
export default gasPage(ReadyView);
