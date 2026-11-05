import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// `pnpm smoke:engines`: live engine calls. Never part of `pnpm test`.
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: { alias: { "server-only": resolve("tests/stubs/server-only.ts") } },
  test: { environment: "node", include: ["tests/smoke/**/*.smoke.ts"], testTimeout: 15 * 60_000, reporters: ["dot"] },
});
