import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The bare-OS battery hits a real local Postgres (DATABASE_URL). Run serially, generous timeout for the
    // migrate step, and force RUMAH_ENV=test so the env loader picks the test posture.
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: { RUMAH_ENV: "test" },
  },
});
