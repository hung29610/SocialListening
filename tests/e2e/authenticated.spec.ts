import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';


const API = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:8010';
const APP = 'http://127.0.0.1:3000';
const PROJECT_A = 73001;
const SOURCE_A = 74001;
const EXPORT_A = 77001;
const tenantA = { email: 'tenant-a@e2e.invalid', password: process.env.E2E_TENANT_A_PASSWORD || '' };
const tenantB = { email: 'tenant-b@e2e.invalid', password: process.env.E2E_TENANT_B_PASSWORD || '' };

type Proof = {
  job: { id: number; organization_id: number; project_id: number };
  pipeline_status: string;
  mention_ids: number[];
  analysis_ids: number[];
  alert_ids: number[];
  report_ids: number[];
  counts: { mentions: number; analyses: number; alerts: number; reports: number };
  redelivery: { redelivery?: { idempotent?: boolean; success?: boolean } };
};

let tokenA = '';
let tokenB = '';
let userA: Record<string, unknown> = {};
let proof: Proof;

async function login(request: APIRequestContext, email: string, password: string): Promise<string> {
  expect(password, `isolated password is configured for ${email}`).not.toBe('');
  const response = await request.post(`${API}/api/auth/login`, { form: { username: email, password } });
  expect(response.status()).toBe(200);
  return (await response.json()).access_token;
}

async function authedPage(browser: Browser, token: string, user: Record<string, unknown>, projectId: number): Promise<Page> {
  const context = await browser.newContext({
    storageState: {
      cookies: [],
      origins: [{
        origin: APP,
        localStorage: [
          { name: 'access_token', value: token },
          { name: 'cached_user', value: JSON.stringify(user) },
          { name: 'nope_active_project_id', value: String(projectId) },
        ],
      }],
    },
  });
  return context.newPage();
}

function guardProductPage(page: Page) {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(`pageerror:${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') failures.push(`console:${message.text()}`);
  });
  page.on('response', response => {
    if (response.url().startsWith(`${API}/api/`) && response.status() >= 400) {
      failures.push(`http:${response.status()}:${new URL(response.url()).pathname}`);
    }
  });
  return failures;
}

async function expectDenied(responsePromise: Promise<import('@playwright/test').APIResponse>) {
  const response = await responsePromise;
  expect([403, 404], `${response.url()} must be tenant denied`).toContain(response.status());
}

test.describe.serial('authenticated MVP contract', () => {
  test.beforeAll(async ({ request }) => {
    tokenA = await login(request, tenantA.email, tenantA.password);
    tokenB = await login(request, tenantB.email, tenantB.password);
    const me = await request.get(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${tokenA}` } });
    expect(me.status()).toBe(200);
    userA = await me.json();
  });

  test('1. anonymous protected access is rejected and login/protected preflights pass', async ({ page, request }) => {
    const anonymous = await request.get(`${API}/api/mentions`);
    expect([401, 403]).toContain(anonymous.status());

    for (const preflight of [
      { path: '/api/auth/login', method: 'POST', headers: 'content-type' },
      { path: '/api/mentions', method: 'GET', headers: 'authorization' },
    ]) {
      const response = await request.fetch(`${API}${preflight.path}`, {
        method: 'OPTIONS',
        headers: {
          Origin: APP,
          'Access-Control-Request-Method': preflight.method,
          'Access-Control-Request-Headers': preflight.headers,
        },
      });
      expect(response.status()).toBe(200);
      expect(response.headers()['access-control-allow-origin']).toBe(APP);
    }

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('2. login succeeds through the real form', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(tenantA.email);
    await page.locator('input[type="password"]').fill(tenantA.password);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    expect(await page.evaluate(() => Boolean(localStorage.getItem('access_token')))).toBe(true);
  });

  test('3. dashboard loads without protected API or console errors', async ({ browser }) => {
    const page = await authedPage(browser, tokenA, userA, PROJECT_A);
    const failures = guardProductPage(page);
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    expect(failures).toEqual([]);
    await page.context().close();
  });

  test('4. Scan Center loads', async ({ browser }) => {
    const page = await authedPage(browser, tokenA, userA, PROJECT_A);
    await page.goto('/dashboard/scan');
    await expect(page.locator('#quick-keyword-input')).toBeVisible();
    await expect(page.getByRole('button', { name: /bắt đầu quét/i })).toBeVisible();
    await page.context().close();
  });

  test('5. Mentions loads and advances with a stable cursor', async ({ browser }) => {
    const page = await authedPage(browser, tokenA, userA, PROJECT_A);
    const pages: Array<{ cursor: string | null; ids: number[] }> = [];
    page.on('response', async response => {
      const url = new URL(response.url());
      if (response.request().method() === 'GET' && url.pathname === '/api/mentions' && response.status() === 200) {
        const body = await response.json();
        pages.push({ cursor: url.searchParams.get('cursor'), ids: body.items.map((item: { id: number }) => item.id) });
      }
    });
    await page.goto('/dashboard/mentions');
    await expect(page.getByText('Cursor fixture mention 01')).toBeVisible();
    await page.getByRole('button', { name: /Next mentions page|Trang mentions tiếp theo/ }).first().click();
    await expect.poll(() => pages.some(item => Boolean(item.cursor))).toBe(true);
    const firstPage = pages.find(item => item.cursor === null);
    const laterPage = pages.find(item => Boolean(item.cursor));
    expect(firstPage).toBeTruthy();
    expect(laterPage).toBeTruthy();
    expect(new Set(firstPage!.ids.filter(id => laterPage!.ids.includes(id))).size).toBe(0);
    await page.context().close();
  });

  test('6. Sources displays the authoritative connector contract', async ({ browser, request }) => {
    const contract = await request.get(`${API}/api/integrations/capabilities`, { headers: { Authorization: `Bearer ${tokenA}` } });
    expect(contract.status()).toBe(200);
    const body = await contract.json();
    expect(body.connectors.rss.state).toBe('READY');
    expect(body.connectors.tiktok.state).toBe('NOT_IMPLEMENTED');

    const page = await authedPage(browser, tokenA, userA, PROJECT_A);
    await page.goto('/dashboard/sources');
    await page.getByRole('button', { name: /kết nối nền tảng/i }).click();
    await expect(page.getByText('RSS / Atom', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('TikTok', { exact: true }).first()).toBeVisible();
    await page.context().close();
  });

  test('7. Reports loads', async ({ browser }) => {
    const page = await authedPage(browser, tokenA, userA, PROJECT_A);
    await page.goto('/dashboard/reports');
    await expect(page.getByRole('heading', { name: /báo cáo pdf/i })).toBeVisible();
    await page.context().close();
  });

  test('8. deterministic RSS scan reaches durable completion exactly once under redelivery', async ({ browser, request }) => {
    const page = await authedPage(browser, tokenA, userA, PROJECT_A);
    await page.goto('/dashboard/scan');
    await page.locator('#quick-keyword-input').fill('e2e-risk-signal');
    await page.locator('#quick-keyword-group').selectOption(String(PROJECT_A));
    await page.locator('input[name="scanMode"][value="ALL_ACTIVE_SOURCES"]').check();
    const scanResponse = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/crawl/manual-scan');
    await page.getByRole('button', { name: /bắt đầu quét/i }).click();
    const accepted = await scanResponse;
    expect(accepted.status()).toBe(200);
    const job = await accepted.json();

    await expect.poll(async () => {
      const response = await request.get(`${API}/_e2e/proof/${job.job_id}`, { headers: { 'X-E2E-Fixture-Key': process.env.E2E_FIXTURE_KEY || '' } });
      if (response.status() !== 200) return null;
      proof = await response.json();
      return proof.pipeline_status;
    }, { timeout: 60_000 }).toBe('completed');

    expect(proof.job).toMatchObject({ organization_id: 71001, project_id: PROJECT_A });
    expect(proof.counts).toEqual({ mentions: 1, analyses: 1, alerts: 1, reports: 1 });
    expect(proof.redelivery.redelivery).toMatchObject({ success: true, idempotent: true });
    await page.context().close();
  });

  test('9. Tenant B cannot read or mutate Tenant A resources', async ({ request }) => {
    const headers = { Authorization: `Bearer ${tokenB}` };
    const mention = proof.mention_ids[0];
    const alert = proof.alert_ids[0];
    const report = proof.report_ids[0];
    const reads = [
      `/api/keywords/groups/${PROJECT_A}`, `/api/sources/${SOURCE_A}`, `/api/mentions/${mention}`,
      `/api/alerts/${alert}`, `/api/reports/${report}`, `/api/reports/exports/${EXPORT_A}`,
      `/api/reports/exports/${EXPORT_A}/download`,
    ];
    for (const path of reads) await expectDenied(request.get(`${API}${path}`, { headers }));

    const mutations = [
      `/api/keywords/groups/${PROJECT_A}`, `/api/sources/${SOURCE_A}`, `/api/mentions/${mention}`,
      `/api/alerts/${alert}`, `/api/reports/${report}`,
    ];
    for (const path of mutations) await expectDenied(request.delete(`${API}${path}`, { headers }));

    for (const path of reads.slice(0, -1)) {
      const ownerRead = await request.get(`${API}${path}`, { headers: { Authorization: `Bearer ${tokenA}` } });
      expect(ownerRead.status(), `Tenant A retains ${path}`).toBe(200);
    }
  });
});
