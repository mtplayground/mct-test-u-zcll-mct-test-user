import { defineConfig, devices } from "@playwright/test";

const port = process.env.PORT || "8080";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  projects: [
    {
      name: "chromium",
      use: devices["Desktop Chrome"],
    },
  ],
  testDir: "tests/e2e",
  timeout: 30_000,
  use: {
    baseURL,
    launchOptions: {
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    },
    permissions: ["camera", "microphone"],
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    env: {
      HOST: "127.0.0.1",
      PORT: port,
    },
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
    url: baseURL,
  },
});
