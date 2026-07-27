/**
 * Detect newly introduced application-owned UI literals.
 *
 * Existing route debt is recorded as exact file/kind/text occurrence counts in
 * hardcoded-ui-baseline.json. A new literal or an added occurrence fails this
 * check. Sweep tickets remove entries naturally as they replace literals with
 * translation calls.
 *
 * Run:
 *   node scripts/check-hardcoded-ui.mjs
 *   node scripts/check-hardcoded-ui.mjs --update-baseline
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import ts from 'typescript';

const frontendDir = path.resolve(import.meta.dirname, '..');
const srcDir = path.join(frontendDir, 'src');
const allowlistPath = path.join(import.meta.dirname, 'hardcoded-ui-allowlist.json');
const baselinePath = path.join(import.meta.dirname, 'hardcoded-ui-baseline.json');
const baselineRepoPath = 'frontend/scripts/hardcoded-ui-baseline.json';
const updateBaseline = process.argv.includes('--update-baseline');

const USER_ATTRIBUTES = new Set([
  'alt',
  'aria-description',
  'aria-label',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
  'cancelLabel',
  'cancelText',
  'confirmLabel',
  'confirmText',
  'description',
  'emptyMessage',
  'errorMessage',
  'helperText',
  'label',
  'loadingText',
  'message',
  'placeholder',
  'submessage',
  'subtitle',
  'title',
  'tooltip',
]);
const USER_CALLS = new Set([
  'alert',
  'confirm',
  'toast',
  'toast.error',
  'toast.loading',
  'toast.success',
  'window.alert',
  'window.confirm',
]);
const MESSAGE_SETTER =
  /^set(?:Error|ErrorMessage|Message|Notice|StatusMessage|SuccessMessage|Warning)$/;
const USER_OBJECT_PROPERTIES = new Set([
  'actionLabel',
  'cancelLabel',
  'cancelText',
  'confirmLabel',
  'confirmText',
  'description',
  'emptyMessage',
  'errorMessage',
  'helperText',
  'label',
  'loadingText',
  'message',
  'name',
  'submessage',
  'subtitle',
  'title',
  'tooltip',
]);
const COPY_CONTAINER_NAME =
  /(?:ACTION|COPY|INTEGRATION|LABEL|MESSAGE|NAV|OPTION|STATUS|TEXT)/i;

const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
const allowedValues = new Set(allowlist.values ?? []);

function filesUnder(dir, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) filesUnder(full, result);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      result.push(full);
    }
  }
  return result;
}

function callName(node) {
  if (ts.isIdentifier(node.expression)) return node.expression.text;
  if (ts.isPropertyAccessExpression(node.expression)) {
    return node.expression.getText();
  }
  return '';
}

function insideTranslation(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isCallExpression(parent) && callName(parent) === 't') return true;
  }
  return false;
}

function technical(value) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text || allowedValues.has(text)) return true;
  if (!/[A-Za-zÀ-ỹ]/.test(text)) return true;
  if (/^(?:https?:\/\/|\/|#)/.test(text)) return true;
  if (/^[a-z0-9]+(?:[-_.:/][a-z0-9]+)*$/.test(text)) return true;
  if (/^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)+$/.test(text)) return true;
  if (/^[A-Z0-9_]+$/.test(text)) return true;
  if (/^\{.*\}$/.test(text)) return true;
  return false;
}

function containingVariableName(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }
  }
  return '';
}

const counts = new Map();
function report(file, sourceFile, node, kind, rawValue) {
  const text = rawValue.replace(/\s+/g, ' ').trim();
  if (technical(text) || insideTranslation(node)) return;
  const relative = path.relative(frontendDir, file).split(path.sep).join('/');
  const fingerprint = `${relative}\u0000${kind}\u0000${text}`;
  counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1);
}

for (const file of filesUnder(srcDir)) {
  if (file.includes(`${path.sep}i18n${path.sep}`)) continue;
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  function reportReturnedCopy(expression, kind) {
    if (
      ts.isStringLiteral(expression) ||
      ts.isNoSubstitutionTemplateLiteral(expression)
    ) {
      report(file, sourceFile, expression, kind, expression.text);
      return;
    }
    if (ts.isTemplateExpression(expression)) {
      report(
        file,
        sourceFile,
        expression,
        kind,
        expression.head.text +
          expression.templateSpans.map(span => span.literal.text).join(' '),
      );
      return;
    }
    if (ts.isConditionalExpression(expression)) {
      reportReturnedCopy(expression.whenTrue, kind);
      reportReturnedCopy(expression.whenFalse, kind);
      return;
    }
    if (ts.isParenthesizedExpression(expression)) {
      reportReturnedCopy(expression.expression, kind);
    }
  }
  function visit(node) {
    if (ts.isJsxText(node)) report(file, sourceFile, node, 'jsx', node.text);
    if (ts.isPropertyAssignment(node)) {
      const name = node.name.getText(sourceFile).replace(/^['"]|['"]$/g, '');
      const initializer = node.initializer;
      const containerName = containingVariableName(node);
      if (
        (USER_OBJECT_PROPERTIES.has(name) ||
          COPY_CONTAINER_NAME.test(containerName)) &&
        (ts.isStringLiteral(initializer) ||
          ts.isNoSubstitutionTemplateLiteral(initializer))
      ) {
        report(file, sourceFile, node, `property:${name}`, initializer.text);
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      (USER_OBJECT_PROPERTIES.has(node.name.text) ||
        COPY_CONTAINER_NAME.test(node.name.text)) &&
      node.initializer &&
      (ts.isStringLiteral(node.initializer) ||
        ts.isNoSubstitutionTemplateLiteral(node.initializer))
    ) {
      report(
        file,
        sourceFile,
        node,
        `variable:${node.name.text}`,
        node.initializer.text,
      );
    }
    if (ts.isReturnStatement(node) && node.expression) {
      reportReturnedCopy(node.expression, 'return');
    }
    if (
      ts.isArrowFunction(node) &&
      !ts.isBlock(node.body)
    ) {
      reportReturnedCopy(node.body, 'arrow-return');
    }
    if (
      ts.isJsxAttribute(node) &&
      node.initializer &&
      USER_ATTRIBUTES.has(node.name.getText(sourceFile))
    ) {
      const initializer = node.initializer;
      if (ts.isStringLiteral(initializer)) {
        report(file, sourceFile, node, `attr:${node.name.getText(sourceFile)}`, initializer.text);
      } else if (
        ts.isJsxExpression(initializer) &&
        initializer.expression &&
        (ts.isStringLiteral(initializer.expression) ||
          ts.isNoSubstitutionTemplateLiteral(initializer.expression))
      ) {
        report(
          file,
          sourceFile,
          node,
          `attr:${node.name.getText(sourceFile)}`,
          initializer.expression.text,
        );
      }
    }
    if (ts.isCallExpression(node)) {
      const name = callName(node);
      if (USER_CALLS.has(name) || MESSAGE_SETTER.test(name)) {
        for (const argument of node.arguments) {
          if (
            ts.isStringLiteral(argument) ||
            ts.isNoSubstitutionTemplateLiteral(argument)
          ) {
            report(file, sourceFile, argument, `call:${name}`, argument.text);
          } else if (ts.isTemplateExpression(argument)) {
            report(
              file,
              sourceFile,
              argument,
              `call:${name}`,
              argument.head.text +
                argument.templateSpans.map(span => span.literal.text).join(' '),
            );
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

const byFile = new Map();
for (const [fingerprint, count] of counts) {
  const [file, kind, text] = fingerprint.split('\u0000');
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file).push([kind, text, count]);
}
function snapshotFromFindings() {
  const files = Object.fromEntries(
    [...byFile.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([file, entries]) => {
        const fingerprints = Object.fromEntries(
          entries
            .map(([kind, text, count]) => [
              crypto
                .createHash('sha256')
                .update(`${kind}\u0000${text}`)
                .digest('hex'),
              count,
            ])
            .sort(([left], [right]) => left.localeCompare(right)),
        );
        return [
          file,
          {
            count: Object.values(fingerprints).reduce(
              (total, count) => total + count,
              0,
            ),
            fingerprints,
          },
        ];
      }),
  );
  return { version: 1, files };
}

const current = snapshotFromFindings();
if (updateBaseline) {
  fs.writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
  console.log(
    `Updated hard-coded UI baseline for ${Object.keys(current.files).length} files (${counts.size} fingerprints).`,
  );
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
if (baseline.version !== 1 || !baseline.files) {
  console.error('Hard-coded UI check failed: unsupported baseline format.');
  process.exit(1);
}

function growthComparedWith(candidate, anchor, label) {
  const growth = [];
  for (const [file, entry] of Object.entries(candidate.files)) {
    const anchorEntry = anchor.files[file];
    if (!anchorEntry) {
      growth.push(`${file}: file added to ${label}`);
      continue;
    }
    for (const [fingerprint, count] of Object.entries(entry.fingerprints)) {
      const anchorCount = anchorEntry.fingerprints[fingerprint] ?? 0;
      if (count > anchorCount) {
        growth.push(
          `${file}: fingerprint ${fingerprint.slice(0, 12)} grew ${anchorCount} → ${count}`,
        );
      }
    }
  }
  return growth;
}

if (process.argv.includes('--self-test-ratchet')) {
  const anchor = {
    version: 1,
    files: {
      'existing.tsx': {
        count: 2,
        fingerprints: { alpha: 1, beta: 1 },
      },
    },
  };
  assert.deepEqual(growthComparedWith(anchor, anchor, 'anchor'), []);
  assert.deepEqual(
    growthComparedWith(
      {
        version: 1,
        files: {
          'existing.tsx': { count: 1, fingerprints: { alpha: 1 } },
        },
      },
      anchor,
      'anchor',
    ),
    [],
  );
  assert.equal(
    growthComparedWith(
      {
        version: 1,
        files: {
          ...anchor.files,
          'new.tsx': { count: 1, fingerprints: { gamma: 1 } },
        },
      },
      anchor,
      'anchor',
    ).length,
    1,
  );
  assert.equal(
    growthComparedWith(
      {
        version: 1,
        files: {
          'existing.tsx': {
            count: 3,
            fingerprints: { alpha: 2, beta: 1 },
          },
        },
      },
      anchor,
      'anchor',
    ).length,
    1,
  );
  assert.equal(
    growthComparedWith(
      {
        version: 1,
        files: {
          'existing.tsx': {
            count: 3,
            fingerprints: { alpha: 1, beta: 1, gamma: 1 },
          },
        },
      },
      anchor,
      'anchor',
    ).length,
    1,
  );
  console.log(
    'Hard-coded UI ratchet self-test passed: shrink accepted; new files, fingerprints, and count increases rejected.',
  );
  process.exit(0);
}

const sourceGrowth = growthComparedWith(current, baseline, 'the reviewed baseline');
if (sourceGrowth.length) {
  console.error(
    `Hard-coded UI check failed: ${sourceGrowth.length} new or increased violation(s).`,
  );
  sourceGrowth.forEach(item => console.error(`  - ${item}`));
  process.exit(1);
}

const repoRoot = path.resolve(frontendDir, '..');
let baseBaseline = null;
try {
  execFileSync('git', ['rev-parse', '--verify', 'origin/main'], {
    cwd: repoRoot,
    stdio: 'ignore',
  });
  try {
    const raw = execFileSync(
      'git',
      ['show', `origin/main:${baselineRepoPath}`],
      { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    baseBaseline = JSON.parse(raw);
  } catch {
    // This ticket introduces the first baseline. Once it exists on main,
    // failure to read or parse it is an enforcement error.
    const existsOnBase = execFileSync(
      'git',
      ['ls-tree', '-r', '--name-only', 'origin/main', '--', baselineRepoPath],
      { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    if (existsOnBase) {
      console.error('Hard-coded UI check failed: unable to read the origin/main baseline.');
      process.exit(1);
    }
  }
} catch {
  console.error(
    'Hard-coded UI check failed: origin/main is required to enforce the baseline ratchet.',
  );
  process.exit(1);
}

if (baseBaseline) {
  const baselineGrowth = growthComparedWith(
    baseline,
    baseBaseline,
    'the origin/main baseline',
  );
  if (baselineGrowth.length) {
    console.error(
      `Hard-coded UI baseline ratchet failed: ${baselineGrowth.length} addition(s) or increase(s).`,
    );
    baselineGrowth.forEach(item => console.error(`  - ${item}`));
    process.exit(1);
  }
}

const reviewedCount = Object.values(baseline.files).reduce(
  (total, entry) => total + entry.count,
  0,
);
console.log(
  `Hard-coded UI ratchet passed: ${Object.keys(baseline.files).length} reviewed files, ${reviewedCount} violations; no files, fingerprints, or counts grew.`,
);
