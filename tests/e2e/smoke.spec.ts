import { expect, test, type Page, type Route } from '@playwright/test';

const user = {
  id: 1, email: 'smoke@example.test', full_name: 'Smoke User',
  is_superuser: true, current_organization_id: 1,
};
const project = {
  id: 1, name: 'Smoke Project', description: 'Deterministic fixture',
  priority: 1, alert_threshold: 10, is_active: true, keyword_count: 1,
  created_at: '2026-01-01T00:00:00Z',
};
let scanSubmitted = false;

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function installApiFixture(page: Page) {
  scanSubmitted = false;
  await page.addInitScript(({ cachedUser }) => {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    localStorage.setItem('access_token', `header.${payload}.signature`);
    localStorage.setItem('cached_user', JSON.stringify(cachedUser));
    localStorage.setItem('nope_active_project_id', '1');
  }, { cachedUser: user });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === '/api/auth/me/context') {
      return json(route, {
        user,
        organizations: [{ id: 1, name: 'Smoke Org', slug: 'smoke', role: 'owner' }],
        permissions: ['*'],
      });
    }
    if (path === '/api/keywords/groups') return json(route, [project]);
    if (path === '/api/sources') return json(route, []);
    if (path === '/api/crawl/capabilities') {
      return json(route, {
        auto_discovery: { configured: true },
        available_modes: ['AUTO_DISCOVERY'],
      });
    }
    if (path === '/api/system/worker-status') {
      return json(route, {
        scheduler_enabled: true, worker_mode: 'test', worker_running: true,
        last_worker_heartbeat: '2026-01-01T00:00:00Z', active_sources: 0,
        due_sources: 0, running_jobs: 0, last_error: null,
      });
    }
    if (path === '/api/crawl/manual-scan' && request.method() === 'POST') {
      scanSubmitted = true;
      return json(route, { id: 9001, job_id: 9001, status: 'pending' });
    }
    if (path === '/api/crawl/jobs') {
      return json(route, {
        items: scanSubmitted ? [{
          id: 9001, job_type: 'manual', source_ids: [], status: 'completed',
          total_sources: 1, processed_sources: 1, mentions_found: 2,
          error_message: null, retry_count: 0, project_id: 1,
          created_at: '2026-01-01T00:00:00Z', started_at: '2026-01-01T00:00:01Z',
          completed_at: '2026-01-01T00:00:02Z',
        }] : [],
        total: scanSubmitted ? 1 : 0, page: 1, page_size: 20,
      });
    }
    if (path === '/api/dashboard/sidebar-badges') {
      return json(route, { new_alerts: 0, open_incidents: 0, unreviewed_mentions: 0 });
    }
    if (path.includes('/schedules')) return json(route, []);
    if (path.startsWith('/api/mentions')) {
      if (path.endsWith('/source-counts') || path.endsWith('/summary') || path.endsWith('/charts')) {
        return json(route, {});
      }
      if (path.endsWith('/topics')) return json(route, []);
      return json(route, { items: [], total: 0, page: 1, page_size: 20 });
    }
    if (path.startsWith('/api/reports')) {
      if (path.endsWith('/summary') || path.endsWith('/summary-data')) return json(route, {});
      return json(route, { items: [], total: 0 });
    }
    if (path.startsWith('/api/dashboard')) return json(route, {});
    if (path.startsWith('/api/keywords')) return json(route, []);
    return json(route, {});
  });
}

test.beforeEach(async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console.error: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 500) {
      browserErrors.push(`HTTP ${response.status()}: ${new URL(response.url()).pathname}`);
    }
  });
  await installApiFixture(page);
  (page as Page & { browserErrors?: string[] }).browserErrors = browserErrors;
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { browserErrors?: string[] }).browserErrors ?? []).toEqual([]);
});

test('public landing route renders', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1')).toBeVisible();
});

test('login route renders', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('form')).toBeVisible();
});

test('dashboard route renders', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({
    timeout: 30_000,
  });
});

test('mentions route renders', async ({ page }) => {
  await page.goto('/dashboard/mentions', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main')).toBeVisible();
});

test('reports route renders', async ({ page }) => {
  await page.goto('/dashboard/reports', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /báo cáo pdf/i })).toBeVisible();
});

test('manual scan reaches a completed history row', async ({ page }) => {
  await page.goto('/dashboard/scan', { waitUntil: 'domcontentloaded' });
  await page.locator('#quick-keyword-input').fill('deterministic smoke keyword');
  await page.getByRole('button', { name: /bắt đầu quét/i }).click();
  await page.getByRole('button', { name: /lịch sử crawl jobs/i }).click();
  await expect(page.getByText('#9001')).toBeVisible();
  await expect(page.getByText('Mentions:').locator('..').getByText('2', { exact: true })).toBeVisible();
});
