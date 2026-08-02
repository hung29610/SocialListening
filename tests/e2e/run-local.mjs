import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const database = 'social_wave2c_e2e';
const worktree = resolve('.');
const python = resolve('.venv', 'Scripts', 'python.exe');
const psql = 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe';
const suffix = `${process.pid}-${Date.now()}`;
const env = {
  ...process.env,
  DATABASE_URL: `postgresql://postgres@127.0.0.1:5432/${database}`,
  TEST_DATABASE_URL: `postgresql://postgres@127.0.0.1:5432/${database}`,
  REDIS_URL: 'redis://127.0.0.1:6379/14',
  TEST_REDIS_URL: 'redis://127.0.0.1:6379/14',
  E2E_REDIS_PREFIX: `nope360:e2e:local:${suffix}`,
  E2E_MEMORY_REDIS: 'true',
  REDIS_ENABLED: 'false',
  E2E_TENANT_A_PASSWORD: `local-a-${suffix}`,
  E2E_TENANT_B_PASSWORD: `local-b-${suffix}`,
  E2E_FIXTURE_KEY: `local-fixture-${suffix}`,
  E2E_API_BASE_URL: 'http://127.0.0.1:8010',
  E2E_PYTHON: python,
  SECRET_KEY: `local-signing-${suffix}`,
  ENVIRONMENT: 'test',
  RUN_MIGRATIONS_ON_STARTUP: 'false',
  ENABLE_EMBEDDED_SCHEDULER: 'false',
  SCHEDULER_ENABLED: 'false',
  AUTO_DISCOVERY_ENABLED: 'false',
  SOCIAL_CRAWL_ENABLED: 'false',
  SEARCH_PROVIDER_ORDER: 'rss',
  FRONTEND_URL: 'http://127.0.0.1:3000',
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: worktree, env, stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(psql, ['-w', '-U', 'postgres', '-d', database, '-h', '127.0.0.1', '-v', 'ON_ERROR_STOP=1',
  '-c', 'DROP SCHEMA public CASCADE', '-c', 'CREATE SCHEMA public']);
run(python, ['tests/e2e/seed.py']);
run(process.execPath, ['tests/e2e/run-ci.mjs']);
