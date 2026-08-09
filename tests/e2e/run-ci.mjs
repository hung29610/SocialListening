import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const report = resolve('test-results', 'auth-e2e-results.json');
const cli = resolve('node_modules', '@playwright', 'test', 'cli.js');
const result = spawnSync(process.execPath, [cli, 'test', '--config=playwright.auth.config.ts'], {
  stdio: 'inherit',
  timeout: 12 * 60_000,
  env: { ...process.env, CI: 'true' },
});
if (result.error) throw result.error;
if (!existsSync(report)) throw new Error('Playwright JSON report is missing');

const data = JSON.parse(readFileSync(report, 'utf8'));
const specs = [];
function visit(suite) {
  for (const spec of suite.specs || []) specs.push(spec);
  for (const child of suite.suites || []) visit(child);
}
for (const suite of data.suites || []) visit(suite);
const tests = specs.flatMap(spec => spec.tests || []);
const skipped = tests.filter(test => test.status === 'skipped' || test.results?.length === 0 || test.results?.at(-1)?.status === 'skipped');
const failed = tests.filter(test => test.status !== 'expected' || test.results?.at(-1)?.status !== 'passed');
if (result.status !== 0 || tests.length !== 10 || skipped.length !== 0 || failed.length !== 0) {
  console.error(`Authenticated E2E gate failed: child=${result.status} tests=${tests.length} skipped=${skipped.length} failed=${failed.length}`);
  process.exit(1);
}
console.log(`AUTHENTICATED_E2E_TESTS=${tests.length}`);
console.log('AUTHENTICATED_E2E_SKIPS=0');
