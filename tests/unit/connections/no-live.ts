import { afterEach, beforeEach, vi } from "vitest";

// Imported by every connections test: the real fetch is replaced, so a code path that forgets the injected
// fetch fails loudly instead of reaching Google. Fixtures only, never live calls in CI.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      throw new Error(`live call blocked: ${new URL(String(input)).host}`);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());
