/**
 * Detect application-owned user-facing strings that are NOT going through the
 * i18n system.
 *
 * Nope360 must render every application-owned string in the selected language
 * (Vietnamese or English). A literal baked into a component always renders in
 * whatever language it was typed in, which is exactly how mixed-language UI
 * appears. This scanner is the enforcement point.
 *
 * What counts as user-facing:
 *   - JSX text nodes
 *   - a curated set of JSX attributes (placeholder, title, aria-label, alt, ...)
 *   - string arguments to toast.*, window.alert/confirm, and *Error/*Message setters
 *
 * What does not:
 *   - technical attributes (className, id, key, href, type, name, data-*, ...)
 *   - import specifiers, object keys, enum-like constants, API field names
 *   - anything already wrapped in t('...')
 *   - lowercase/technical tokens such as css classes, routes and mime types
 *
 * Run: node scripts/check-hardcoded-ui.mjs [--json] [--by-file]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, '../src');
const ALLOWLIST_FILE = path.join(__dirname, 'hardcoded-ui-allowlist.json');

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const byFile = args.has('--by-file');

/** Files that legitimately contain no localizable UI. */
const FILE_EXCLUDES = [
  /\.test\.tsx?$/,
  /[\\/]i18n[\\/]/,
  /[\\/]types?[\\/]/,
  /\.d\.ts$/,
];

/** JSX attributes whose value is shown to (or read out to) a user. */
const USER_FACING_ATTRS = new Set([
  'placeholder',
  'title',
  'alt',
  'label',
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'aria-valuetext',
  'aria-roledescription',
  'message',
  'submessage',
  'description',
  'subtitle',
  'heading',
  'emptyMessage',
  'errorMessage',
  'helperText',
  'tooltip',
  'confirmText',
  'cancelText',
  'confirmLabel',
  'cancelLabel',
  'actionLabel',
  'buttonLabel',
  'emptyText',
  'loadingText',
]);

/** Attributes that are always technical. */
const TECHNICAL_ATTRS = new Set([
  'className', 'class', 'id', 'key', 'href', 'src', 'srcSet', 'type', 'name', 'rel', 'target',
  'style', 'role', 'width', 'height', 'viewBox', 'fill', 'stroke', 'd', 'points', 'transform',
  'xmlns', 'clipRule', 'fillRule', 'strokeWidth', 'strokeLinecap', 'strokeLinejoin', 'offset',
  'stopColor', 'gradientUnits', 'patternUnits', 'preserveAspectRatio', 'value', 'defaultValue',
  'htmlFor', 'method', 'action', 'encType', 'accept', 'autoComplete', 'inputMode', 'pattern',
  'min', 'max', 'step', 'maxLength', 'minLength', 'rows', 'cols', 'colSpan', 'rowSpan',
  'dateFormat', 'locale', 'dataKey', 'nameKey', 'stackId', 'layout', 'orientation', 'align',
  'verticalAlign', 'position', 'cursor', 'axisLine', 'tickLine', 'labelKey', 'testId',
  'data-testid', 'suppressHydrationWarning', 'sizes', 'loading', 'as', 'variant', 'size',
  'color', 'colorScheme', 'tone', 'status', 'icon', 'iconPosition', 'shape', 'radius',
]);

/** Functions whose first string argument is shown to the user. */
const USER_FACING_CALLS = new Set([
  'toast', 'toast.success', 'toast.error', 'toast.info', 'toast.warning', 'toast.loading',
  'toast.custom', 'alert', 'window.alert', 'confirm', 'window.confirm',
]);

/** State setters that hold a user-visible message. */
const MESSAGE_SETTER = /^set(?:Error|ErrorMessage|Message|Status|StatusMessage|Notice|Warning|Info|Toast|Success|SuccessMessage|Hint|Label|Title|Subtitle|EmptyMessage|Feedback)$/;

function loadAllowlist() {
  if (!fs.existsSync(ALLOWLIST_FILE)) {
    return { values: [], filePrefixes: [], reasons: {} };
  }
  const raw = JSON.parse(fs.readFileSync(ALLOWLIST_FILE, 'utf8'));
  return {
    values: new Set((raw.values || []).map(v => v.trim())),
    filePrefixes: raw.filePrefixes || [],
    reasons: raw.reasons || {},
  };
}

const allowlist = loadAllowlist();

function walkFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function relative(file) {
  return path.relative(path.join(__dirname, '..'), file).split(path.sep).join('/');
}

/** Technical-looking tokens never shown as prose. */
function isTechnicalToken(value) {
  const v = value.trim();
  if (!v) return true;
  if (!/[A-Za-zÀ-ỹ]/.test(v)) return true;              // digits/symbols only
  if (v.length < 2) return true;
  if (/^[a-z0-9]+([-_.:/][a-z0-9]+)*$/.test(v)) return true; // slug / route / mime / css
  if (/^[A-Z0-9_]+$/.test(v)) return true;               // ENUM_CONSTANT
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return true;        // colour
  if (/^\d+(\.\d+)?(px|rem|em|%|vh|vw|s|ms)$/.test(v)) return true;
  if (/^https?:\/\//.test(v) || v.startsWith('/')) return true;
  if (/^[a-z]+([A-Z][a-z0-9]*)+$/.test(v)) return true;  // camelCaseIdentifier
  if (/^\{.*\}$/.test(v)) return true;
  if (/^(?:\s*[|/,·•\-–—]\s*)+$/.test(v)) return true;
  // HTML entities are punctuation, not translatable text. They appear because
  // react/no-unescaped-entities requires quotes in JSX text to be escaped.
  if (/^(?:&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);|\s)+$/.test(v)) return true;
  // Entities mixed only with ellipsis/punctuation, e.g. `...&rdquo;` used to close
  // a truncated quotation around interpolated content.
  if (/^(?:&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);|[.\s…,;:!?'"«»\-–—])+$/.test(v)) return true;
  return false;
}

function isAllowlisted(value) {
  return allowlist.values.has(value.trim());
}

function fileAllowlisted(rel) {
  return allowlist.filePrefixes.some(prefix => rel.startsWith(prefix));
}

function callName(node) {
  const expr = node.expression;
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) {
    const left = ts.isIdentifier(expr.expression)
      ? expr.expression.text
      : ts.isPropertyAccessExpression(expr.expression)
        ? `${expr.expression.expression.getText?.() ?? ''}.${expr.expression.name.text}`
        : '';
    return left ? `${left}.${expr.name.text}` : expr.name.text;
  }
  return '';
}

/** Is this node inside a t('...') / useLanguage translation call? */
function insideTranslationCall(node) {
  let current = node.parent;
  while (current) {
    if (ts.isCallExpression(current)) {
      const name = callName(current);
      if (name === 't' || name.endsWith('.t') || name === 'translate') return true;
    }
    current = current.parent;
  }
  return false;
}

const findings = [];

function scanFile(file) {
  const rel = relative(file);
  if (FILE_EXCLUDES.some(re => re.test(rel)) || fileAllowlisted(rel)) return;

  const code = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const report = (node, value, kind) => {
    const text = value.replace(/\s+/g, ' ').trim();
    if (!text || isTechnicalToken(text) || isAllowlisted(text)) return;
    if (insideTranslationCall(node)) return;
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    findings.push({ file: rel, line: line + 1, kind, text });
  };

  const visit = node => {
    // 1. JSX text between tags.
    if (ts.isJsxText(node)) {
      report(node, node.text, 'jsx-text');
    }

    // 2. Curated JSX attributes.
    if (ts.isJsxAttribute(node) && node.initializer) {
      const attr = node.name.getText(sourceFile);
      if (!TECHNICAL_ATTRS.has(attr) && USER_FACING_ATTRS.has(attr)) {
        const init = node.initializer;
        if (ts.isStringLiteral(init)) {
          report(node, init.text, `attr:${attr}`);
        } else if (ts.isJsxExpression(init) && init.expression) {
          const expr = init.expression;
          if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
            report(node, expr.text, `attr:${attr}`);
          }
        }
      }
    }

    // 3. toast.* / alert / confirm arguments.
    if (ts.isCallExpression(node)) {
      const name = callName(node);
      if (USER_FACING_CALLS.has(name)) {
        for (const arg of node.arguments) {
          if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
            report(arg, arg.text, `call:${name}`);
          } else if (ts.isTemplateExpression(arg)) {
            const literalPart = arg.head.text + arg.templateSpans.map(s => s.literal.text).join(' ');
            report(arg, literalPart, `call:${name}`);
          }
        }
      }
      // 4. setError('...') style message setters.
      if (MESSAGE_SETTER.test(name)) {
        for (const arg of node.arguments) {
          if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
            report(arg, arg.text, `call:${name}`);
          } else if (ts.isTemplateExpression(arg)) {
            const literalPart = arg.head.text + arg.templateSpans.map(s => s.literal.text).join(' ');
            report(arg, literalPart, `call:${name}`);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

for (const file of walkFiles(SRC_DIR)) {
  scanFile(file);
}

if (asJson) {
  console.log(JSON.stringify(findings, null, 2));
  process.exit(findings.length ? 1 : 0);
}

const perFile = new Map();
for (const finding of findings) {
  if (!perFile.has(finding.file)) perFile.set(finding.file, []);
  perFile.get(finding.file).push(finding);
}

if (findings.length === 0) {
  console.log('✅ No hardcoded application-owned UI strings found.');
  console.log(`   (allowlist: ${allowlist.values.size} value(s), ${allowlist.filePrefixes.length} path prefix(es))`);
  process.exit(0);
}

const sorted = [...perFile.entries()].sort((a, b) => b[1].length - a[1].length);

if (byFile) {
  for (const [file, items] of sorted) {
    console.log(`${items.length}\t${file}`);
  }
} else {
  console.log(`❌ ${findings.length} hardcoded application-owned UI string(s) in ${perFile.size} file(s):\n`);
  for (const [file, items] of sorted) {
    console.log(`${file} (${items.length})`);
    for (const item of items.slice(0, 12)) {
      const preview = item.text.length > 70 ? `${item.text.slice(0, 70)}…` : item.text;
      console.log(`  L${item.line} [${item.kind}] ${preview}`);
    }
    if (items.length > 12) console.log(`  … ${items.length - 12} more`);
    console.log('');
  }
  console.log('Move these into src/i18n/locales/{vi,en}.ts and render them with t(...).');
  console.log('Genuine proper nouns / technical constants belong in scripts/hardcoded-ui-allowlist.json.');
}

process.exit(1);
