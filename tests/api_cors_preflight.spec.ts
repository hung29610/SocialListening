import { expect, test } from '@playwright/test';

const apiBaseUrl = (
  process.env.PLAYWRIGHT_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL
)?.replace(/\/+$/, '');
const appOrigin =
  process.env.PLAYWRIGHT_APP_ORIGIN ||
  'https://social-listening-azure.vercel.app';

test('app API base accepts an authenticated-route CORS preflight', async ({
  request,
}) => {
  expect(
    apiBaseUrl,
    'Set PLAYWRIGHT_API_BASE_URL or the frontend NEXT_PUBLIC API URL',
  ).toBeTruthy();

  const response = await request.fetch(
    `${apiBaseUrl}/api/crawl/schedules`,
    {
      method: 'OPTIONS',
      headers: {
        Origin: appOrigin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    },
  );

  expect(response.status()).toBe(200);
  expect(response.headers()['access-control-allow-origin']).toBe(appOrigin);
});
