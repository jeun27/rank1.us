import type { Metadata } from "next";
import { gasPage } from "../params";
import { AiAccessView } from "./AiAccessView";

export const metadata: Metadata = { title: "G2 Can AI see your site?", robots: { index: false } };
export default gasPage(AiAccessView);
