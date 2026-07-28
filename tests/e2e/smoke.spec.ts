import { expect, test, type Page, type Route, type StorageState } from '@playwright/test';

const user = {
  id: 1,
  email: 'smoke@example.test',
  full_name: 'Smoke User',
  is_superuser: true,
  current_organization_id: 1,
};
const project = {
  id: 1,
  name: 'Smoke Project',
  description: 'Deterministic fixture',
  priority: 1,
  alert_threshold: 10,
  is_active: true,
  keyword_count: 1,
  created_at: '2026-01-01T00:00:00Z',
};
const tokenPayload = Buffer.from(JSON.stringify({ exp: 4_102_444_800 })).toString('base64url');
const authenticatedStorageState: StorageState = {
  cookies: [],
  origins: [{
    origin: 'http://127.0.0.1:3000',
    localStorage: [
      { name: 'access_token', value: `header.${tokenPayload}.signature` },
      { name: 'cached_user', value: JSON.stringify(user) },
      { name: 'nope_active_project_id', value: '1' },
    ],
  }],
};

type FixtureState = {
  unexpectedRequests: string[];
  browserErrors: string[];
  scanStatuses: string[];
  scanPost?: { status: number; jobId: number };
  scanSubmitted: boolean;
  scanPollCount: number;
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function installBrowserGuards(page: Page, state: FixtureState) {
  page.on('pageerror', (error) => state.browserErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') state.browserErrors.push(`console.error: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 500) {
      state.browserErrors.push(`HTTP ${response.status()}: ${new URL(response.url()).pathname}`);
    }
  });
}

async function installStrictApiFixture(page: Page, state: FixtureState) {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const key = `${request.method()} ${path}`;

    if (key === 'GET /api/auth/me/context') {
      return json(route, {
        user,
        organizations: [{ id: 1, name: 'Smoke Org', slug: 'smoke', role: 'owner' }],
        permissions: ['*'],
      });
    }
    if (key === 'GET /api/auth/me') return json(route, user);
    if (key === 'GET /api/auth/me/preferences') {
      return json(route, { language: 'vi', theme: 'system' });
    }
    if (key === 'GET /api/keywords/groups') return json(route, [project]);
    if (key === 'GET /api/dashboard/sidebar-badges') {
      return json(route, { new_alerts: 0, open_incidents: 0, unreviewed_mentions: 0 });
    }
    if (key === 'GET /api/dashboard/summary') return json(route, {});
    if (key === 'GET /api/dashboard/trends') return json(route, []);
    if (key === 'GET /api/dashboard/sentiment-summary') return json(route, {});
    if (key === 'GET /api/dashboard/hot-keywords') return json(route, []);
    if (key === 'GET /api/mentions') {
      return json(route, { items: [], total: 0, page: 1, page_size: 20 });
    }
    if (key === 'GET /api/mentions/source-counts') return json(route, {});
    if (key === 'GET /api/mentions/charts') return json(route, { data: [] });
    if (key === 'GET /api/mentions/topics') return json(route, []);
    if (key === 'GET /api/saved-filters') return json(route, []);
    if (key === 'GET /api/reports/summary-data') return json(route, {});
    if (key === 'GET /api/reports/exports/history') {
      return json(route, { items: [], total: 0, page: 1, page_size: 10 });
    }
    if (key === 'GET /api/sources') return json(route, []);
    if (key === 'GET /api/crawl/capabilities') {
      return json(route, {
        auto_discovery: { configured: true },
        available_modes: ['AUTO_DISCOVERY'],
      });
    }
    if (key === 'GET /api/system/worker-status') {
      return json(route, {
        scheduler_enabled: true,
        worker_mode: 'test',
        worker_running: true,
        last_worker_heartbeat: '2026-01-01T00:00:00Z',
        active_sources: 0,
        due_sources: 0,
        running_jobs: 0,
        last_error: null,
      });
    }
    if (key === 'GET /api/crawl/schedules') {
      return json(route, { items: [], total: 0, page: 1, page_size: 100 });
    }
    if (key === 'POST /api/crawl/manual-scan') {
      state.scanSubmitted = true;
      const response = { job_id: 9001, id: 9001, status: 'pending' };
      state.scanPost = { status: 202, jobId: response.job_id };
      return json(route, response, 202);
    }
    if (key === 'GET /api/crawl/jobs') {
      if (!state.scanSubmitted) {
        return json(route, { items: [], total: 0, page: 1, page_size: 20 });
      }
      const statuses = ['pending', 'running', 'completed'];
      const status = statuses[Math.min(state.scanPollCount, statuses.length - 1)];
      state.scanPollCount += 1;
      state.scanStatuses.push(status);
      return json(route, {
        items: [{
          id: 9001,
          job_type: 'manual',
          source_ids: [],
          status,
          total_sources: 1,
          processed_sources: status === 'pending' ? 0 : 1,
          mentions_found: status === 'completed' ? 2 : 0,
          error_message: null,
          retry_count: 0,
          project_id: 1,
          created_at: '2026-01-01T00:00:00Z',
          started_at: status === 'pending' ? null : '2026-01-01T00:00:01Z',
          completed_at: status === 'completed' ? '2026-01-01T00:00:02Z' : null,
        }],
        total: 1,
        page: 1,
        page_size: 20,
      });
    }

    state.unexpectedRequests.push(key);
    return json(route, { detail: `Unexpected smoke API request: ${key}` }, 599);
  });
}

test.describe('public routes stay unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('landing renders the real SignalHero and one page heading', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-signal-scene="hero"]')).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('login exposes the complete credential form', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel(/mật khẩu/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
  });
});

test.describe('authenticated product smoke', () => {
  test.use({ storageState: authenticatedStorageState });
  let state: FixtureState;

  test.beforeEach(async ({ page }) => {
    state = {
      unexpectedRequests: [],
      browserErrors: [],
      scanStatuses: [],
      scanSubmitted: false,
      scanPollCount: 0,
    };
    installBrowserGuards(page, state);
    await installStrictApiFixture(page, state);
  });

  test.afterEach(() => {
    expect(state.unexpectedRequests, 'all product API calls must be explicitly fixture-backed').toEqual([]);
    expect(state.browserErrors, 'page errors, console.error, and HTTP 5xx must fail smoke').toEqual([]);
  });

  test('dashboard renders its product heading', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('mentions renders filters and a truthful empty state', async ({ page }) => {
    await page.goto('/dashboard/mentions', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /danh sách bộ lọc/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /chưa có dữ liệu/i })).toBeVisible();
  });

  test('reports renders its real data state', async ({ page }) => {
    await page.goto('/dashboard/reports', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /báo cáo pdf/i })).toBeVisible();
    await expect(page.getByText(/phạm vi báo cáo/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /nội dung báo cáo/i })).toBeVisible();
  });

  test('manual scan is accepted and polled to completed history', async ({ page }) => {
    await page.goto('/dashboard/scan', { waitUntil: 'domcontentloaded' });
    await page.locator('#quick-keyword-input').fill('deterministic smoke keyword');

    const scanResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/api/crawl/manual-scan'
    );
    await page.getByRole('button', { name: /bắt đầu quét/i }).click();
    const scanResponse = await scanResponsePromise;
    const scanBody = await scanResponse.json();

    expect(scanResponse.status()).toBeGreaterThanOrEqual(200);
    expect(scanResponse.status()).toBeLessThan(300);
    expect(scanBody.job_id).toBe(9001);
    expect(state.scanPost).toEqual({ status: 202, jobId: 9001 });

    await expect(page.getByText('#9001').first()).toBeVisible();
    await expect(page.getByText(/chờ/i, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/đang chạy/i, { exact: true }).first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/xong/i, { exact: true }).first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Mentions:').locator('..').getByText('2', { exact: true })).toBeVisible();
    expect(state.scanStatuses).toEqual(['pending', 'running', 'completed']);
  });
});
