import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const layout = fs.readFileSync(path.join(root, 'src/app/dashboard/layout.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/lib/api.ts'), 'utf8');
const en = fs.readFileSync(path.join(root, 'src/i18n/locales/en.ts'), 'utf8');
const vi = fs.readFileSync(path.join(root, 'src/i18n/locales/vi.ts'), 'utf8');

const required = [
  [api, "mode: 'standard' | 'free_mvp_embedded'"],
  [api, 'celery_durability_claimed: boolean'],
  [layout, "status.runtime?.mode === 'free_mvp_embedded'"],
  [layout, "t('header.freeMvpEmbedded')"],
  [layout, 'status.celery_worker.status'],
  [en, "freeMvpEmbedded: 'FREE MVP / EMBEDDED'"],
  [vi, 'freeMvpEmbedded:'],
];

for (const [source, needle] of required) {
  if (!source.includes(needle)) {
    throw new Error(`Free runtime UI contract missing: ${needle}`);
  }
}

if (layout.includes("freeMvpEmbedded ? t('header.workerOnline')")) {
  throw new Error('Free embedded mode must never be labeled as a Celery worker');
}

console.log('free runtime frontend contract: PASS');
