/**
 * Enforce the two-locale dictionary contract.
 *
 * Run: node scripts/check-i18n-keys.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const frontendDir = path.resolve(import.meta.dirname, '..');
const localeDir = path.join(frontendDir, 'src/i18n/locales');
const supported = ['vi', 'en'];
const retired = ['th', 'ja', 'ko', 'zh'];

function propertyName(node, sourceFile) {
  if (
    ts.isIdentifier(node) ||
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node)
  ) {
    return node.text;
  }
  return node.getText(sourceFile);
}

function localeLeaves(locale) {
  const file = path.join(localeDir, `${locale}.ts`);
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const leaves = new Map();

  function walkObject(node, prefix = '') {
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const name = propertyName(property.name, sourceFile);
      const key = prefix ? `${prefix}.${name}` : name;
      const value = property.initializer;
      if (ts.isObjectLiteralExpression(value)) {
        walkObject(value, key);
      } else if (
        ts.isStringLiteral(value) ||
        ts.isNoSubstitutionTemplateLiteral(value)
      ) {
        leaves.set(key, value.text);
      }
    }
  }

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === locale &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      walkObject(node.initializer);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return leaves;
}

const errors = [];
const localeFiles = fs
  .readdirSync(localeDir)
  .filter(file => file.endsWith('.ts'))
  .map(file => path.basename(file, '.ts'))
  .sort();

if (JSON.stringify(localeFiles) !== JSON.stringify([...supported].sort())) {
  errors.push(
    `locale files must be exactly en.ts and vi.ts (found: ${localeFiles.join(', ')})`,
  );
}
for (const locale of retired) {
  if (fs.existsSync(path.join(localeDir, `${locale}.ts`))) {
    errors.push(`retired locale file still exists: ${locale}.ts`);
  }
}

const maps = Object.fromEntries(supported.map(locale => [locale, localeLeaves(locale)]));
for (const locale of supported) {
  for (const [key, value] of maps[locale]) {
    if (!value.trim()) errors.push(`${locale}.${key} is empty`);
    if (/^(TODO|TBD|TRANSLATE_ME)$/i.test(value.trim())) {
      errors.push(`${locale}.${key} is a placeholder value`);
    }
  }
}

for (const key of maps.vi.keys()) {
  if (!maps.en.has(key)) errors.push(`missing en key: ${key}`);
}
for (const key of maps.en.keys()) {
  if (!maps.vi.has(key)) errors.push(`missing vi key: ${key}`);
}

function placeholders(value) {
  return [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
}
for (const [key, viValue] of maps.vi) {
  const enValue = maps.en.get(key);
  if (enValue === undefined) continue;
  if (
    JSON.stringify(placeholders(viValue)) !==
    JSON.stringify(placeholders(enValue))
  ) {
    errors.push(`placeholder mismatch at ${key}`);
  }
}

const indexSource = fs.readFileSync(
  path.join(frontendDir, 'src/i18n/index.ts'),
  'utf8',
);
for (const locale of retired) {
  if (new RegExp(`locales/${locale}['"]`).test(indexSource)) {
    errors.push(`retired locale import remains in i18n/index.ts: ${locale}`);
  }
}

if (errors.length) {
  console.error(`I18N check failed with ${errors.length} error(s):`);
  errors.forEach(error => console.error(`  - ${error}`));
  process.exit(1);
}

console.log(
  `I18N check passed: vi/en only, ${maps.vi.size} keys each, full parity, matching placeholders.`,
);
