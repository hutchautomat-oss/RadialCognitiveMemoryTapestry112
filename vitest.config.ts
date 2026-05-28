import { defineConfig } from "vitest/config";

/**
 * Root vitest config.
 *
 * Discovers `*.test.ts` files across every workspace package (artifacts/* and
 * lib/*). The suite is intentionally small — every test pins a real
 * architectural decision documented in replit.md or .agents/memory/, not
 * coverage. Pure-Node environment by default; no jsdom, no R3F canvas tests.
 *
 * Per-package invocation is also supported via `pnpm --filter @workspace/<name>
 * run test`, which simply re-invokes vitest scoped to that package.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "artifacts/**/*.test.ts",
      "lib/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.replit-artifact/**"],
    passWithNoTests: false,
  },
});
