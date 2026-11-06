import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The PNG exports read the bundled Inter files at runtime (components/audit/respond.ts).
  outputFileTracingIncludes: {
    "/audit/[token]/export.png": ["./src/components/audit/fonts/*.woff"],
    "/app/runs/[runId]/export.png": ["./src/components/audit/fonts/*.woff"],
    // The report PDF embeds the same Inter files (lib/reports/document.tsx).
    "/app/report": ["./src/components/audit/fonts/*.woff"],
    "/app/report/preview.pdf": ["./src/components/audit/fonts/*.woff"],
    "/dev/report-preview.pdf": ["./src/components/audit/fonts/*.woff"],
    "/api/cron/run-jobs": ["./src/components/audit/fonts/*.woff"],
  },
  partialPrefetching: true,
  // The audit token is in the URL: never send it on as a referrer (cited links, assets).
  async headers() {
    return [
      {
        source: "/audit/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
