/**
 * Executable contract tests for the two-locale policy.
 *
 * The project does not currently ship a unit-test runner. This script uses the
 * TypeScript compiler already installed by the frontend to execute the real
 * policy modules with Node.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const frontendDir = path.resolve(import.meta.dirname, '..');
const sourceDir = path.join(frontendDir, 'src');
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nope-i18n-'));

function transpile(relativeSource, relativeOutput = relativeSource.replace(/\.ts$/, '.mjs')) {
  const sourcePath = path.join(sourceDir, relativeSource);
  const outputPath = path.join(outputDir, relativeOutput);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, result.outputText, 'utf8');
  return outputPath;
}

function check(name, run) {
  run();
  console.log(`  ✓ ${name}`);
}

async function asyncCheck(name, run) {
  await run();
  console.log(`  ✓ ${name}`);
}

try {
  const localePolicyPath = transpile('i18n/localePolicy.ts');
  const preferencePath = transpile('i18n/languagePreferences.ts');
  const apiErrorsPath = transpile('lib/apiErrors.ts');
  const locale = await import(pathToFileURL(localePolicyPath).href);
  // Point the transpiled relative import at the generated ESM policy module.
  const preferenceSource = fs
    .readFileSync(preferencePath, 'utf8')
    .replace("from './localePolicy'", "from './localePolicy.mjs'");
  fs.writeFileSync(preferencePath, preferenceSource, 'utf8');
  const preferences = await import(pathToFileURL(preferencePath).href);
  const apiErrors = await import(pathToFileURL(apiErrorsPath).href);

  console.log('Locale policy');
  check('supports exactly Vietnamese and English', () => {
    assert.deepEqual(locale.SUPPORTED_LANGUAGES, ['vi', 'en']);
    assert.equal(locale.DEFAULT_LANGUAGE, 'vi');
  });
  check('keeps supported stored values', () => {
    assert.equal(locale.normalizeStoredLanguage('vi'), 'vi');
    assert.equal(locale.normalizeStoredLanguage('en'), 'en');
  });
  check('maps every retired stored value to English', () => {
    for (const retired of ['th', 'ja', 'ko', 'zh']) {
      assert.equal(locale.normalizeStoredLanguage(retired), 'en');
    }
  });
  check('maps missing, corrupt, regional, and unknown stored values to Vietnamese', () => {
    for (const invalid of [null, undefined, '', 'fr', 'en-US', 'VI', 42, {}]) {
      assert.equal(locale.normalizeStoredLanguage(invalid), 'vi');
    }
  });
  check('interpolates translation parameters without dropping unknown placeholders', () => {
    assert.equal(
      locale.interpolateTranslation('Hello {name}, {count} result(s), {missing}', {
        name: 'Lan',
        count: 2,
      }),
      'Hello Lan, 2 result(s), {missing}',
    );
  });
  check('pre-paint bootstrap applies the same stored-value policy', () => {
    for (const [stored, expected] of [
      [null, 'vi'],
      ['vi', 'vi'],
      ['en', 'en'],
      ['th', 'en'],
      ['ja', 'en'],
      ['ko', 'en'],
      ['zh', 'en'],
      ['broken', 'vi'],
    ]) {
      const values = new Map(stored === null ? [] : [['app_language', stored]]);
      const documentElement = { lang: 'vi', dataset: {} };
      vm.runInNewContext(locale.LANGUAGE_BOOTSTRAP_SCRIPT, {
        localStorage: {
          getItem: key => values.get(key) ?? null,
          setItem: (key, value) => values.set(key, value),
        },
        document: { documentElement },
      });
      assert.equal(documentElement.lang, expected);
      assert.equal(values.get('app_language'), expected);
      assert.equal(documentElement.dataset.i18nPending, expected === 'en' ? 'true' : undefined);
    }
  });

  console.log('Preference persistence');
  function memoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
      values,
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
  }
  check('normalizes the mirror lazily on read', () => {
    const retired = memoryStorage({ app_language: 'ja' });
    assert.equal(preferences.readLanguageMirror(retired), 'en');
    assert.equal(retired.values.get('app_language'), 'en');

    const corrupt = memoryStorage({ app_language: 'broken' });
    assert.equal(preferences.readLanguageMirror(corrupt), 'vi');
    assert.equal(corrupt.values.get('app_language'), 'vi');
  });
  await asyncCheck('lets the server win and refreshes the mirror', async () => {
    const storage = memoryStorage({ app_language: 'en' });
    const calls = [];
    const transport = {
      get: async () => ({ data: { language: 'vi' } }),
      put: async (...args) => calls.push(args),
    };
    assert.equal(
      await preferences.syncServerLanguagePreference(transport, { storage }),
      'vi',
    );
    assert.equal(storage.values.get('app_language'), 'vi');
    assert.equal(calls.length, 0);
  });
  await asyncCheck('normalizes a retired server value and writes it back lazily', async () => {
    const storage = memoryStorage();
    const calls = [];
    const transport = {
      get: async () => ({ data: { language: 'zh' } }),
      put: async (...args) => calls.push(args),
    };
    assert.equal(
      await preferences.syncServerLanguagePreference(transport, { storage }),
      'en',
    );
    assert.equal(storage.values.get('app_language'), 'en');
    assert.deepEqual(calls[0].slice(0, 2), [
      '/api/auth/me/preferences',
      { language: 'en' },
    ]);
  });
  await asyncCheck('keeps an optimistic selection when account saving fails', async () => {
    const storage = memoryStorage({ app_language: 'vi' });
    let active = 'vi';
    let warningLanguage = null;
    const transport = {
      get: async () => ({ data: { language: 'vi' } }),
      put: async () => {
        throw new Error('save failed');
      },
    };
    await preferences.applyLanguageSelection({
      requested: 'en',
      storage,
      transport,
      onApply: language => {
        active = language;
      },
      onSaveFailure: language => {
        warningLanguage = language;
      },
    });
    assert.equal(active, 'en');
    assert.equal(storage.values.get('app_language'), 'en');
    assert.equal(warningLanguage, 'en');
  });

  console.log('API error localization');
  const translations = new Map([
    ['errors.code.invalid_credentials', 'Invalid email or password.'],
    ['errors.status.notFound', 'The requested item was not found.'],
    ['errors.network', 'Unable to connect.'],
    ['errors.unknown', 'Something went wrong.'],
  ]);
  const t = key => translations.get(key) ?? key;

  check('uses a known stable error code before backend prose', () => {
    const result = apiErrors.getLocalizedApiError(
      {
        response: {
          status: 401,
          data: { error_code: 'invalid_credentials', detail: 'Sai email hoặc mật khẩu.' },
        },
      },
      t,
    );
    assert.equal(result.message, 'Invalid email or password.');
    assert.equal(result.code, 'invalid_credentials');
    assert.equal(result.usedRawMessage, false);
  });
  check('accepts stable codes from case-preserving backends', () => {
    const result = apiErrors.getLocalizedApiError(
      {
        response: {
          status: 401,
          data: { detail: 'Sai email hoặc mật khẩu.' },
          headers: { 'X-Error-Code': 'INVALID_CREDENTIALS' },
        },
      },
      t,
    );
    assert.equal(result.message, 'Invalid email or password.');
    assert.equal(result.code, 'INVALID_CREDENTIALS');
  });
  check('falls back to raw backend prose when no known code exists', () => {
    const result = apiErrors.getLocalizedApiError(
      { response: { status: 404, data: { detail: 'Không tìm thấy.' } } },
      t,
    );
    assert.equal(result.message, 'Không tìm thấy.');
    assert.equal(result.usedRawMessage, true);
  });
  check('uses a localized status fallback when the backend supplies no prose', () => {
    const result = apiErrors.getLocalizedApiError(
      { response: { status: 404, data: {} } },
      t,
    );
    assert.equal(result.message, 'The requested item was not found.');
    assert.equal(result.usedRawMessage, false);
  });
  check('uses a localized network message when no response exists', () => {
    const result = apiErrors.getLocalizedApiError(new Error('Network Error'), t);
    assert.equal(result.message, 'Unable to connect.');
    assert.equal(result.usedRawMessage, false);
  });

  console.log('\nAll locale behavior checks passed.');
} finally {
  fs.rmSync(outputDir, { recursive: true, force: true });
}
