/**
 * Runtime checks for the Nope360 locale policy helpers in src/i18n/index.ts.
 *
 * The frontend has no test runner configured, so this script is the executable
 * safety net for locale resolution: it transpiles the real i18n module with the
 * TypeScript compiler already present in devDependencies, imports it, and
 * asserts the behaviour that keeps the UI from ending up half-translated.
 *
 * Run: node scripts/check-locale-behavior.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const i18nDir = path.join(__dirname, '../src/i18n');
const outDir = path.join(__dirname, '../node_modules/.cache/nope360-locale-check');

function transpile(srcFile, outFile) {
  const source = fs.readFileSync(srcFile, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
    fileName: path.basename(srcFile),
  });
  // Rewrite extensionless relative imports so Node's ESM loader can resolve them.
  const patched = outputText.replace(/from ['"]\.\/locales\/(vi|en)['"]/g, "from './$1.js'");
  fs.writeFileSync(outFile, patched, 'utf8');
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

transpile(path.join(i18nDir, 'locales/vi.ts'), path.join(outDir, 'vi.js'));
transpile(path.join(i18nDir, 'locales/en.ts'), path.join(outDir, 'en.js'));
transpile(path.join(i18nDir, 'index.ts'), path.join(outDir, 'index.js'));

const i18n = await import(pathToFileURL(path.join(outDir, 'index.js')).href);

const {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  RETIRED_LANGUAGES,
  dictionaries,
  languageNames,
  isSupportedLanguage,
  resolveLanguage,
  detectBrowserLanguage,
} = i18n;

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`  ✓ ${name}`);
}

console.log('Locale policy');
check('exactly vi + en are supported', () => {
  assert.deepEqual([...SUPPORTED_LANGUAGES].sort(), ['en', 'vi']);
});
check('default language is Vietnamese', () => {
  assert.equal(DEFAULT_LANGUAGE, 'vi');
});
check('only supported dictionaries are loaded', () => {
  assert.deepEqual(Object.keys(dictionaries).sort(), ['en', 'vi']);
});
check('language selector exposes exactly the supported languages', () => {
  assert.deepEqual(Object.keys(languageNames).sort(), ['en', 'vi']);
  assert.equal(languageNames.vi, 'Tiếng Việt');
  assert.equal(languageNames.en, 'English');
});
check('retired locales are not loadable', () => {
  for (const retired of RETIRED_LANGUAGES) {
    assert.equal(dictionaries[retired], undefined, `${retired} must not be loaded`);
    assert.equal(isSupportedLanguage(retired), false, `${retired} must not be supported`);
  }
});

console.log('resolveLanguage');
check('exact supported tags pass through', () => {
  assert.equal(resolveLanguage('vi'), 'vi');
  assert.equal(resolveLanguage('en'), 'en');
});
check('regional tags resolve to their base language', () => {
  assert.equal(resolveLanguage('vi-VN'), 'vi');
  assert.equal(resolveLanguage('en-US'), 'en');
  assert.equal(resolveLanguage('en-GB'), 'en');
  assert.equal(resolveLanguage('en_AU'), 'en');
});
check('casing and whitespace are normalised', () => {
  assert.equal(resolveLanguage('  EN  '), 'en');
  assert.equal(resolveLanguage('Vi-Vn'), 'vi');
});
check('retired locales fall back to Vietnamese', () => {
  for (const retired of RETIRED_LANGUAGES) {
    assert.equal(resolveLanguage(retired), 'vi', `${retired} must fall back to vi`);
  }
  assert.equal(resolveLanguage('zh-CN'), 'vi');
  assert.equal(resolveLanguage('ja-JP'), 'vi');
});
check('unknown and malformed values fall back to Vietnamese', () => {
  assert.equal(resolveLanguage('fr'), 'vi');
  assert.equal(resolveLanguage(''), 'vi');
  assert.equal(resolveLanguage('   '), 'vi');
  assert.equal(resolveLanguage(null), 'vi');
  assert.equal(resolveLanguage(undefined), 'vi');
  assert.equal(resolveLanguage(42), 'vi');
  assert.equal(resolveLanguage({}), 'vi');
});
check('an explicit fallback is honoured', () => {
  assert.equal(resolveLanguage('th', 'en'), 'en');
  assert.equal(resolveLanguage(null, 'en'), 'en');
});

console.log('detectBrowserLanguage');
check('picks the first supported entry', () => {
  assert.equal(detectBrowserLanguage(['ja-JP', 'ko-KR', 'en-US', 'vi-VN']), 'en');
  assert.equal(detectBrowserLanguage(['vi-VN', 'en-US']), 'vi');
});
check('falls back when nothing is supported', () => {
  assert.equal(detectBrowserLanguage(['th-TH', 'zh-CN']), 'vi');
  assert.equal(detectBrowserLanguage([]), 'vi');
  assert.equal(detectBrowserLanguage(undefined), 'vi');
});

console.log('Dictionary shape');
check('both dictionaries expose the auth section used by login/register', () => {
  for (const locale of SUPPORTED_LANGUAGES) {
    const dict = dictionaries[locale];
    assert.ok(dict.auth, `${locale}.auth missing`);
    for (const key of ['loginTitle', 'passwordLabel', 'errorInvalidCredentials', 'registerTitle']) {
      assert.equal(typeof dict.auth[key], 'string', `${locale}.auth.${key} must be a string`);
      assert.ok(dict.auth[key].trim().length > 0, `${locale}.auth.${key} must not be empty`);
    }
    assert.equal(typeof dict.common.changeLanguage, 'string');
  }
});
check('vi and en auth strings actually differ', () => {
  assert.notEqual(dictionaries.vi.auth.loginTitle, dictionaries.en.auth.loginTitle);
  assert.notEqual(dictionaries.vi.auth.errorInvalidCredentials, dictionaries.en.auth.errorInvalidCredentials);
});

fs.rmSync(outDir, { recursive: true, force: true });
console.log(`\nAll ${checks} locale behaviour checks passed.`);
