import type { Metadata } from "next";
import { gasPage } from "../params";
import { LoopView } from "./LoopView";

export const metadata: Metadata = { title: "The GAS loop", robots: { index: false } };
export default gasPage(LoopView);
