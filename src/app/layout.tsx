import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { themeScript } from "@/lib/theme";
import "./globals.css";

// v3 (D33): self-hosted by next/font at build time (no runtime requests to Google). Both are OFL.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rank1 - Be the brand AI names first.",
  description:
    "See how often ChatGPT, Gemini, Google AI Overview and Perplexity name your business, how you stack up against competitors, and what to fix next.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme="dark"
      className={`${inter.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        {/* Sets data-theme before first paint: dark for public pages, the saved or system theme for /app and /team. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full bg-paper font-sans text-body text-ink">{children}</body>
    </html>
  );
}
