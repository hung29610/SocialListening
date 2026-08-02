import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const failures = [];
const requireText = (source, value, label) => {
  if (!source.includes(value)) failures.push(`${label}: missing ${value}`);
};
const rejectText = (source, value, label) => {
  if (source.includes(value)) failures.push(`${label}: prohibited ${value}`);
};

const types = read('src/lib/connectorCapabilities.ts');
for (const state of ['READY', 'CONFIG_REQUIRED', 'OAUTH_REQUIRED', 'BEST_EFFORT_UNSUPPORTED', 'NOT_IMPLEMENTED']) {
  requireText(types, `'${state}'`, 'capability states');
}
for (const connector of ['rss', 'website', 'google_news_rss', 'newsapi', 'youtube', 'facebook_page', 'instagram_business', 'twitter', 'reddit', 'tiktok']) {
  requireText(types, `'${connector}'`, 'connector ids');
}

const hook = read('src/hooks/useConnectorCapabilities.ts');
requireText(hook, '/api/integrations/capabilities', 'authoritative endpoint');

for (const surface of [
  'src/app/dashboard/integrations/page.tsx',
  'src/app/dashboard/integrations/meta/page.tsx',
  'src/app/dashboard/sources/page.tsx',
  'src/app/dashboard/mentions/page.tsx',
  'src/components/reports/InfographicExportNotice.tsx',
]) {
  requireText(read(surface), 'useConnectorCapabilities', surface);
}

const api = read('src/lib/api.ts');
requireText(api, '/api/integrations/capabilities', 'scan capability client');
rejectText(api, "api.get('/api/crawl/capabilities')", 'legacy scan capability client');

const sources = read('src/app/dashboard/sources/page.tsx');
for (const prohibited of ['Email/Username Facebook', 'Password', 'AIzaSy...']) {
  rejectText(sources, prohibited, 'sources honesty');
}

const integrations = read('src/app/dashboard/integrations/page.tsx');
rejectText(integrations, "actionLabel: 'Connect'", 'integration actions');
requireText(integrations, "action === 'META_OAUTH'", 'Meta OAuth action');

const infographic = read('src/components/reports/InfographicExportNotice.tsx');
requireText(infographic, 'preview_only', 'infographic preview-only contract');
rejectText(infographic, 'Export Image', 'infographic download claim');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Connector capability frontend contract: PASS (10 connectors, 5 states, 5 UI surfaces).');
