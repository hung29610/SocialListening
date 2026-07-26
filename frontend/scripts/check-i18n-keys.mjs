/**
 * Locale policy check for Nope360.
 *
 * Nope360 ships exactly two product languages: Vietnamese (vi) and English (en).
 * This script fails the build when:
 *   - a key exists in vi but not en, or in en but not vi (parity, both ways);
 *   - a retired locale file (th/ja/ko/zh) reappears under src/i18n/locales;
 *   - src/i18n/index.ts stops declaring exactly vi + en as supported;
 *   - a translation value is empty, or is byte-identical across vi and en while
 *     looking like real prose (a copy/paste placeholder rather than a translation).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.join(__dirname, '../src/i18n/locales');
const indexFile = path.join(__dirname, '../src/i18n/index.ts');

const SUPPORTED_LOCALES = ['vi', 'en'];
const RETIRED_LOCALES = ['th', 'ja', 'ko', 'zh'];
const REFERENCE_LOCALE = 'vi';

/**
 * Values legitimately identical in both languages: brand names, third-party
 * product names, technical identifiers and symbols.
 */
const SHARED_VALUE_ALLOWLIST = new Set([
  'nope360',
  'ok',
  'rss',
  'atom',
  'api',
  'url',
  'id',
  'email',
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'x',
  'excel',
  'csv',
  'pdf',
  'ai',
  'seo',
  'utc',
  // Third-party product names and platform labels: intentionally identical.
  'infographic',
  'webinar',
  'facebook page',
  'facebook group',
  'twitter/x',
  'reddit',
  'podcast',
  'linkedin',
  'telegram',
  'zalo',
  'api & webhooks',
  'webhooks',
  // Format / platform / font / city names: identical in both languages.
  'hashtag',
  'favicon',
  'times new roman',
  'courier',
  'bangkok (gmt+7)',
  'singapore (gmt+8)',
  'tokyo (gmt+9)',
  'facebook:',
  'youtube:',
  'rss feed:',
  'rss feed',
  'facebook page',
  'facebook profile',
  'facebook group',
  'youtube channel',
  'youtube video',
  'instagram business',
]);

let hasError = false;

function fail(message) {
  hasError = true;
  console.log(`\n❌ ${message}`);
}

function extractEntries(node, prefix = '') {
  let entries = [];
  if (ts.isObjectLiteralExpression(node)) {
    node.properties.forEach(prop => {
      if (ts.isPropertyAssignment(prop)) {
        const keyName = prop.name.text || prop.name.escapedText;
        if (ts.isObjectLiteralExpression(prop.initializer)) {
          entries = entries.concat(extractEntries(prop.initializer, prefix + keyName + '.'));
        } else {
          const initializer = prop.initializer;
          const value =
            ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)
              ? initializer.text
              : initializer.getText();
          entries.push({ key: prefix + keyName, value });
        }
      }
    });
  }
  return entries;
}

function readLocaleEntries(locale) {
  const filePath = path.join(localesDir, `${locale}.ts`);
  const code = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(`${locale}.ts`, code, ts.ScriptTarget.Latest, true);

  let entries = [];
  const walk = node => {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      entries = extractEntries(node.initializer);
    }
    ts.forEachChild(node, walk);
  };
  walk(sourceFile);

  if (entries.length === 0) {
    console.error(`Failed to parse keys from ${locale}.ts.`);
    process.exit(1);
  }
  return entries;
}

// ─── 1. Retired locales must not come back ────────────────────────────────────

const presentLocaleFiles = fs
  .readdirSync(localesDir)
  .filter(name => name.endsWith('.ts'))
  .map(name => name.replace(/\.ts$/, ''));

const revived = presentLocaleFiles.filter(locale => RETIRED_LOCALES.includes(locale));
if (revived.length > 0) {
  fail(
    `Retired locale file(s) present: ${revived.join(', ')}.\n` +
      `   Nope360 supports only ${SUPPORTED_LOCALES.join(' + ')}. Remove the file(s) or update the locale policy deliberately.`
  );
}

const unexpected = presentLocaleFiles.filter(
  locale => !SUPPORTED_LOCALES.includes(locale) && !RETIRED_LOCALES.includes(locale)
);
if (unexpected.length > 0) {
  fail(`Unknown locale file(s): ${unexpected.join(', ')}. Add them to the policy in this script before shipping.`);
}

for (const locale of SUPPORTED_LOCALES) {
  if (!presentLocaleFiles.includes(locale)) {
    fail(`Required locale file missing: ${locale}.ts`);
  }
}

// ─── 2. index.ts must declare exactly the supported set ───────────────────────

const indexSource = fs.readFileSync(indexFile, 'utf8');
const supportedMatch = indexSource.match(/SUPPORTED_LANGUAGES\s*:\s*Language\[\]\s*=\s*\[([^\]]*)\]/);
if (!supportedMatch) {
  fail('Could not find SUPPORTED_LANGUAGES in src/i18n/index.ts.');
} else {
  const declared = supportedMatch[1]
    .split(',')
    .map(part => part.trim().replace(/['"]/g, ''))
    .filter(Boolean);
  const sameSet =
    declared.length === SUPPORTED_LOCALES.length && SUPPORTED_LOCALES.every(locale => declared.includes(locale));
  if (!sameSet) {
    fail(`SUPPORTED_LANGUAGES is [${declared.join(', ')}] but the policy is [${SUPPORTED_LOCALES.join(', ')}].`);
  }
}

for (const retired of RETIRED_LOCALES) {
  const importPattern = new RegExp(`from\\s+'\\./locales/${retired}'`);
  if (importPattern.test(indexSource)) {
    fail(`src/i18n/index.ts still imports the retired locale '${retired}'.`);
  }
}

if (hasError) {
  console.error('\nI18N Policy Check Failed.');
  process.exit(1);
}

// ─── 3. Key parity in both directions ─────────────────────────────────────────

const entriesByLocale = {};
for (const locale of SUPPORTED_LOCALES) {
  entriesByLocale[locale] = readLocaleEntries(locale);
}

const reference = entriesByLocale[REFERENCE_LOCALE];
const referenceKeys = new Set(reference.map(e => e.key));

for (const locale of SUPPORTED_LOCALES) {
  if (locale === REFERENCE_LOCALE) continue;
  const current = new Set(entriesByLocale[locale].map(e => e.key));
  const missing = [...referenceKeys].filter(k => !current.has(k));
  const extra = [...current].filter(k => !referenceKeys.has(k));

  if (missing.length > 0 || extra.length > 0) {
    hasError = true;
    console.log(`\n❌ Locale ${locale} parity mismatch vs ${REFERENCE_LOCALE}!`);
    if (missing.length > 0) {
      console.log(`   Missing in ${locale} (${missing.length}):`);
      missing.forEach(k => console.log(`     - ${k}`));
    }
    if (extra.length > 0) {
      console.log(`   Present in ${locale} but not ${REFERENCE_LOCALE} (${extra.length}):`);
      extra.forEach(k => console.log(`     - ${k}`));
    }
  } else {
    console.log(`✅ Locale ${locale} has full key parity with ${REFERENCE_LOCALE} (${referenceKeys.size} keys)`);
  }
}

// ─── 4. Placeholder / untranslated value detection ────────────────────────────

const valueMaps = {};
for (const locale of SUPPORTED_LOCALES) {
  valueMaps[locale] = new Map(entriesByLocale[locale].map(e => [e.key, e.value]));
}

const emptyValues = [];
for (const locale of SUPPORTED_LOCALES) {
  for (const [key, value] of valueMaps[locale]) {
    if (typeof value === 'string' && value.trim() === '') {
      emptyValues.push(`${locale}: ${key}`);
    }
  }
}
if (emptyValues.length > 0) {
  hasError = true;
  console.log(`\n❌ Empty translation values (${emptyValues.length}):`);
  emptyValues.forEach(entry => console.log(`     - ${entry}`));
}

/** A value that is likely prose rather than a shared identifier. */
function looksLikeProse(value) {
  if (typeof value !== 'string') return false;
  // Drop punctuation, digits, interpolation braces and masking glyphs so that
  // values like "••••••••" or "{count}/{total}" are not treated as prose.
  const stripped = value.replace(/[{}\d\s.,:;%()/+\-–—…!?'"«»•*#@&|[\]]/g, '');
  if (stripped.length < 4) return false;
  if (SHARED_VALUE_ALLOWLIST.has(value.trim().toLowerCase())) return false;
  // Multi-word prose, or a single word long enough to be a real term.
  return /\s/.test(value.trim()) || stripped.length >= 6;
}

const identicalProse = [];
for (const [key, viValue] of valueMaps[REFERENCE_LOCALE]) {
  const enValue = valueMaps.en.get(key);
  if (enValue === undefined) continue; // already reported as a parity error
  if (viValue === enValue && looksLikeProse(viValue)) {
    identicalProse.push({ key, value: viValue });
  }
}

if (identicalProse.length > 0) {
  hasError = true;
  console.log(
    `\n❌ ${identicalProse.length} key(s) have identical vi/en prose — likely an untranslated copy/paste.` +
      `\n   Translate the value, or add the term to SHARED_VALUE_ALLOWLIST in this script if it is a proper noun:`
  );
  identicalProse.forEach(({ key, value }) => console.log(`     - ${key}: "${value}"`));
}

if (hasError) {
  console.error('\nI18N Check Failed.');
  process.exit(1);
}

console.log(`\nLocale policy OK: ${SUPPORTED_LOCALES.join(' + ')} only, full parity, no placeholder values.`);
