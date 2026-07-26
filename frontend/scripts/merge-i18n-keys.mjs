/**
 * Merge batch key files produced during the localization migration into
 * src/i18n/locales/{vi,en}.ts.
 *
 * Input: a directory of JSON files shaped as
 *   { "namespace.some.key": { "vi": "…", "en": "…" }, … }
 *
 * The merge is AST-guided: for each key path it finds the deepest object literal
 * that already exists and inserts only the missing part as TypeScript source, so
 * existing formatting and comments are preserved. Keys that already exist are
 * skipped (reported, never overwritten).
 *
 * Usage:
 *   node scripts/merge-i18n-keys.mjs <keys-dir> [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const keysDir = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!keysDir || !fs.existsSync(keysDir)) {
  console.error('Usage: node scripts/merge-i18n-keys.mjs <keys-dir> [--dry-run]');
  process.exit(2);
}

const LOCALES = ['vi', 'en'];
const localePath = locale => path.join(__dirname, '../src/i18n/locales', `${locale}.ts`);

// ─── Load and validate the batch files ───────────────────────────────────────

const batchFiles = fs.readdirSync(keysDir).filter(f => f.endsWith('.json')).sort();
if (batchFiles.length === 0) {
  console.error(`No .json files in ${keysDir}`);
  process.exit(2);
}

/** key path -> { vi, en, sources: [batch…] } */
const merged = new Map();
const problems = [];

for (const file of batchFiles) {
  const full = path.join(keysDir, file);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (err) {
    problems.push(`${file}: invalid JSON (${err.message})`);
    continue;
  }
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('_')) continue;
    if (!value || typeof value !== 'object') {
      problems.push(`${file}: ${key} is not an object`);
      continue;
    }
    const viText = value.vi;
    const enText = value.en;
    if (typeof viText !== 'string' || !viText.trim()) {
      problems.push(`${file}: ${key} has no usable "vi" value`);
      continue;
    }
    if (typeof enText !== 'string' || !enText.trim()) {
      problems.push(`${file}: ${key} has no usable "en" value`);
      continue;
    }
    if (!/^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z0-9_]+)+$/.test(key)) {
      problems.push(`${file}: ${key} is not a valid dotted key path`);
      continue;
    }
    if (merged.has(key)) {
      const existing = merged.get(key);
      if (existing.vi !== viText || existing.en !== enText) {
        problems.push(`${key}: conflicting values from ${existing.sources.join(', ')} and ${file}`);
      }
      existing.sources.push(file);
      continue;
    }
    merged.set(key, { vi: viText, en: enText, sources: [file] });
  }
}

console.log(`Loaded ${batchFiles.length} batch file(s): ${merged.size} unique key(s)`);
if (problems.length) {
  console.log(`\n⚠ ${problems.length} problem(s) in the batch files:`);
  problems.slice(0, 40).forEach(p => console.log(`   - ${p}`));
  if (problems.length > 40) console.log(`   … ${problems.length - 40} more`);
}

// ─── AST helpers ─────────────────────────────────────────────────────────────

function parse(code, fileName) {
  return ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true);
}

/** Find the root object literal of `export const <locale> = { … }`. */
function findRootObject(sourceFile) {
  let root = null;
  const visit = node => {
    if (
      !root &&
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      root = node.initializer;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return root;
}

function propName(prop) {
  if (!prop.name) return null;
  if (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) return prop.name.text;
  return prop.name.getText?.() ?? null;
}

/**
 * Walk `segments` from `objectLiteral`, returning
 * { node, depth } for the deepest existing object literal.
 */
function descend(objectLiteral, segments) {
  let current = objectLiteral;
  let depth = 0;
  for (const segment of segments) {
    const match = current.properties.find(
      p => ts.isPropertyAssignment(p) && propName(p) === segment,
    );
    if (!match || !ts.isPropertyAssignment(match)) break;
    if (!ts.isObjectLiteralExpression(match.initializer)) {
      // A leaf already occupies this path.
      return { node: current, depth, leafConflict: segments.slice(0, depth + 1).join('.') };
    }
    current = match.initializer;
    depth += 1;
  }
  return { node: current, depth };
}

function keyLiteral(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : `'${name.replace(/'/g, "\\'")}'`;
}

function valueLiteral(value) {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

/** Render nested object source for the remaining segments. */
function renderNested(segments, value, indent) {
  if (segments.length === 1) {
    return `${indent}${keyLiteral(segments[0])}: ${valueLiteral(value)},\n`;
  }
  const [head, ...rest] = segments;
  return (
    `${indent}${keyLiteral(head)}: {\n` +
    renderNested(rest, value, indent + '  ') +
    `${indent}},\n`
  );
}

// ─── Merge per locale ────────────────────────────────────────────────────────

const report = { inserted: 0, skippedExisting: 0, conflicts: [] };

for (const locale of LOCALES) {
  const file = localePath(locale);
  let code = fs.readFileSync(file, 'utf8');

  // Insertions are computed against the original text, then applied from the
  // bottom up so earlier offsets stay valid.
  const insertions = [];
  const perLocaleSkipped = [];

  // Group keys so that several new keys sharing a new parent are emitted once.
  const sourceFile = parse(code, `${locale}.ts`);
  const root = findRootObject(sourceFile);
  if (!root) {
    console.error(`Could not find the root object literal in ${locale}.ts`);
    process.exit(1);
  }

  // Bucket keys by the deepest existing object literal they attach to.
  const buckets = new Map(); // insertPos -> { indent, entries: [ [segments, value] ] }

  for (const [key, value] of merged) {
    const segments = key.split('.');
    const { node, depth, leafConflict } = descend(root, segments.slice(0, -1));

    if (leafConflict) {
      report.conflicts.push(`${locale}: ${key} conflicts with existing leaf ${leafConflict}`);
      continue;
    }

    // Already present?
    const remaining = segments.slice(depth);
    if (remaining.length === 1) {
      const exists = node.properties.some(
        p => ts.isPropertyAssignment(p) && propName(p) === remaining[0],
      );
      if (exists) {
        perLocaleSkipped.push(key);
        continue;
      }
    }

    const insertPos = node.getStart(sourceFile) + 1; // just after '{'
    const lineStart = code.lastIndexOf('\n', node.getStart(sourceFile)) + 1;
    const baseIndent = code.slice(lineStart, node.getStart(sourceFile)).match(/^\s*/)[0];
    const indent = baseIndent + '  ';

    if (!buckets.has(insertPos)) buckets.set(insertPos, { indent, entries: [] });
    buckets.get(insertPos).entries.push([remaining, value[locale]]);
  }

  for (const [insertPos, bucket] of buckets) {
    // Merge entries that share a new parent so we do not emit the parent twice.
    const tree = new Map();
    for (const [segments, value] of bucket.entries) {
      let cursor = tree;
      for (let i = 0; i < segments.length - 1; i += 1) {
        if (!cursor.has(segments[i])) cursor.set(segments[i], new Map());
        cursor = cursor.get(segments[i]);
      }
      cursor.set(segments[segments.length - 1], value);
    }

    const renderTree = (node, indent) => {
      let out = '';
      for (const [name, child] of node) {
        if (child instanceof Map) {
          out += `${indent}${keyLiteral(name)}: {\n${renderTree(child, indent + '  ')}${indent}},\n`;
        } else {
          out += `${indent}${keyLiteral(name)}: ${valueLiteral(child)},\n`;
        }
      }
      return out;
    };

    insertions.push({ pos: insertPos, text: `\n${renderTree(tree, bucket.indent)}`.replace(/\n$/, '\n') });
  }

  insertions.sort((a, b) => b.pos - a.pos);
  for (const { pos, text } of insertions) {
    code = code.slice(0, pos) + text + code.slice(pos);
  }

  const insertedCount = [...buckets.values()].reduce((sum, b) => sum + b.entries.length, 0);
  if (locale === 'vi') {
    report.inserted = insertedCount;
    report.skippedExisting = perLocaleSkipped.length;
  }

  console.log(
    `${locale}.ts: ${insertedCount} key(s) inserted, ${perLocaleSkipped.length} already present`,
  );

  if (!dryRun) {
    fs.writeFileSync(file, code, 'utf8');
  }
}

if (report.conflicts.length) {
  console.log(`\n⚠ ${report.conflicts.length} conflict(s):`);
  report.conflicts.slice(0, 30).forEach(c => console.log(`   - ${c}`));
}

console.log(dryRun ? '\nDry run: nothing written.' : '\nMerge written to both locale files.');
process.exit(problems.length || report.conflicts.length ? 1 : 0);
