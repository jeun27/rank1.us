import type { Metadata } from "next";
import { Fraunces, Public_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], weight: "600" });
const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"], weight: ["400", "600"] });

export const metadata: Metadata = {
  title: "Rank1 - Be the brand AI names first.",
  description:
    "See how often ChatGPT, Gemini, Google AI Overview and Perplexity name your business, how you stack up against competitors, and what to fix next.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${publicSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-paper font-sans text-body text-ink">{children}</body>
    </html>
  );
}
