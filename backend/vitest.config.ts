import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Locally, pick up DATABASE_URL etc. from the repo-root .env (CI sets real env vars instead).
const rootEnv = new URL("../.env", import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    testTimeout: 15_000,
    // DB-backed tests share one database; run files one at a time.
    fileParallelism: false,
    env: {
      // The mock server listens on 127.0.0.1.
      ALLOW_PRIVATE_TARGETS: "true",
      RESEND_API_KEY: "",
    },
  },
});
