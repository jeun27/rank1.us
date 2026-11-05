import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// `pnpm smoke:engines`: live engine calls. Never part of `pnpm test`.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: { environment: "node", include: ["tests/smoke/**/*.smoke.ts"], testTimeout: 15 * 60_000, reporters: ["dot"] },
});
