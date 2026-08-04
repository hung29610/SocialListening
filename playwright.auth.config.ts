import { defineConfig, devices } from '@playwright/test';

const python = process.env.E2E_PYTHON || 'python';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  outputDir: 'test-results/auth-e2e',
  reporter: process.env.CI
    ? [['line'], ['json', { outputFile: 'test-results/auth-e2e-results.json' }]]
    : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{
    name: 'authenticated-chromium',
    use: { ...devices['Desktop Chrome'] },
  }],
  webServer: [
    {
      command: `"${python}" tests/e2e/backend_server.py`,
      url: 'http://127.0.0.1:8010/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm --prefix frontend run dev -- --hostname 127.0.0.1',
      url: 'http://127.0.0.1:3000/login',
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:8010',
        NEXT_PUBLIC_API_URL: 'http://127.0.0.1:8010',
      },
    },
  ],
});
