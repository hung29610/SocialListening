import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const limitMs = 180_000;
const startedAt = Date.now();
const playwrightCli = resolve('node_modules', '@playwright', 'test', 'cli.js');
const result = spawnSync(process.execPath, [playwrightCli, 'test', '--reporter=line'], {
  stdio: 'inherit',
  timeout: limitMs,
});
const elapsedMs = Date.now() - startedAt;
const elapsedSeconds = (elapsedMs / 1000).toFixed(1);

console.log(`PLAYWRIGHT_CI_RUNTIME_SECONDS=${elapsedSeconds}`);
console.log(`PLAYWRIGHT_CI_LIMIT_SECONDS=${limitMs / 1000}`);

if (result.error?.code === 'ETIMEDOUT' || elapsedMs >= limitMs) {
  console.error(`Playwright smoke exceeded the ${limitMs / 1000}s CI gate.`);
  process.exit(1);
}
if (result.error) {
  console.error(`Unable to run Playwright: ${result.error.message}`);
}
process.exit(result.status ?? 1);
