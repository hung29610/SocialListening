import { defineConfig, devices } from '@playwright/test';

const backendCommand = process.platform === 'win32'
  ? '.venv\\Scripts\\python.exe tests/e2e/backend_server.py'
  : 'python tests/e2e/backend_server.py';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 7_500 },
  reporter: process.env.CI ? 'line' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: backendCommand,
      url: 'http://127.0.0.1:8010/health',
      reuseExistingServer: false,
      timeout: 90_000,
    },
    {
      command: 'npm --prefix frontend run dev -- --hostname 127.0.0.1',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:8010',
      },
    },
  ],
});
