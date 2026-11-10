import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "istanbul",
      skipFull: false,
      include: ["src/lib/order-state.ts", "src/lib/order-access.ts", "src/lib/storage-path.ts"],
      thresholds: { lines: 85, functions: 90, statements: 85, branches: 75 },
    },
  },
});