import type { Metadata } from "next";
import { IndexView } from "./IndexView";
import { gasPage } from "./params";

export const metadata: Metadata = { title: "GAS prototypes", robots: { index: false } };
export default gasPage(IndexView);
