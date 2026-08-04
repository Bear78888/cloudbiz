import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests (§37.3). They run against a real browser, a real Next.js
 * server and a real Supabase — locally the CLI stack (`supabase start`), in CI
 * the same stack on the runner. Nothing is stubbed: RLS, the auth server and
 * the activity triggers are all in the loop, which is the point.
 *
 * `E2E_BASE_URL` points the suite at an already-running server (a preview or
 * production URL); without it Playwright starts `next start` itself.
 */

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
const usesExternalServer = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  // A failing e2e test is a real signal; a flaky one that passes on retry is
  // still worth seeing, so retries are logged rather than silent.
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    // Chromium in a container cannot use the sandbox.
    launchOptions: { args: ["--no-sandbox", "--disable-dev-shm-usage"] },
  },

  projects: [
    {
      name: "chromium",
      // The mobile spec asserts the phone layout; running it at desktop width
      // would assert the opposite of what it means.
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // §13.9 explicitly requires the phone layout to work, so it gets its own run.
      name: "mobile",
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],

  webServer: usesExternalServer
    ? undefined
    : {
        command: "npm run start -- --port 3100",
        url: "http://127.0.0.1:3100/en",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // Without this the server's own errors are invisible in CI and a
        // failing test can only say "the element was not there".
        stdout: "pipe",
        stderr: "pipe",
      },
});
