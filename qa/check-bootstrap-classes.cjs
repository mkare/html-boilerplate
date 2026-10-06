#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pugLexer = require('pug-lexer');
const pugParser = require('pug-parser');

const repoRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(repoRoot, 'src');
const fixturesRoot = path.join(__dirname, 'fixtures', 'bootstrap-classes');
const breakpoints = '(?:sm|md|lg|xl|xxl)';

// Classes provided by the Sass modules retained in ADR-002. The two small
// list utilities are project-owned equivalents, not Bootstrap output.
const retainedClasses = new Set([
  'container', 'container-fluid', 'row', 'col', 'col-auto',
  'list-unstyled', 'my-0',
  'nav', 'nav-link', 'nav-item', 'nav-tabs', 'nav-pills', 'nav-underline', 'nav-fill', 'nav-justified',
]);
const retainedPatterns = [
  new RegExp(`^container-${breakpoints}$`),
  new RegExp(`^col-${breakpoints}$`),
  new RegExp(`^col-${breakpoints}-(?:auto|[1-9]|1[0-2])$`),
  new RegExp(`^offset-(?:${breakpoints}-)?(?:[0-9]|1[0-1])$`),
  new RegExp(`^row-cols-(?:${breakpoints}-)?(?:auto|[1-6])$`),
  new RegExp(`^g[xy]?(?:-${breakpoints})?-[0-5]$`),
  /^col-(?:[1-9]|1[0-2])$/,
];

// Known Bootstrap utilities and helpers. Ordinary components such as `alert`
// or `form-control` are outside this utility check, since the project may own
// a same-named class. Matching is against whole class tokens.
const bootstrapClassPatterns = [
  /^(?:align|vertical-align|float|object-fit|opacity|overflow|position|top|bottom|start|end|translate-middle|display|d|shadow|focus-ring|border|rounded|width|w|max-width|mw|viewport-width|vw|height|h|max-height|mh|viewport-height|vh|margin|m|mx|my|mt|me|mb|ms|padding|p|px|py|pt|pe|pb|ps|gap|row-gap|column-gap|text|font|fs|fw|fst|lh|line-height|bg|link|list|user-select|cursor|flex|justify|order|z)-(?:.+)$/,
  /^(?:visually-hidden|visually-hidden-focusable|clearfix|stretched-link|ratio|vr|visible|invisible|border|rounded|shadow|fixed-top|fixed-bottom|sticky-top|sticky-bottom|vstack|hstack)$/,
  /^nav-(?:tabs|pills|underline|fill|justified)$/,
  /^col(?:-|$)/,
  /^container(?:-|$)/,
  /^row(?:-|$)/,
  /^offset(?:-|$)/,
  /^g[xy]?(?:-|$)/,
];

function walkFiles(directory, found = []) {
  if (!fs.existsSync(directory)) return found;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walkFiles(absolute, found);
    else if (entry.isFile() && entry.name.endsWith('.pug')) found.push(absolute);
  }
  return found;
}

function collectStringLiteralClasses(expression) {
  const classes = [];
  const source = String(expression || '');
  const literal = /(['"])(?:\\.|(?!\1)[\s\S])*?\1|`(?:\\.|[^`])*`/g;
  for (const match of source.matchAll(literal)) {
    let value = match[0].slice(1, -1);
    // Interpolated segments are runtime values. Retain the literal portions
    // around them so fixed class tokens in template strings are still checked.
    value = value.replace(/\$\{[^}]*\}/g, ' ');
    for (const token of value.split(/\s+/).filter(Boolean)) classes.push(token);
  }
  return classes;
}

function collectPugClasses(source, filename) {
  const ast = pugParser(pugLexer(source, { filename }), { filename });
  const found = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node.type === 'Tag') {
      for (const attribute of node.attrs || []) {
        if (attribute.name !== 'class') continue;
        for (const className of collectStringLiteralClasses(attribute.val)) {
          found.push({ className, line: attribute.line || node.line || 1 });
        }
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'filename' || key === 'line' || key === 'column' || key === 'val') continue;
      visit(value);
    }
  };
  visit(ast);
  return found;
}

function isRetained(className) {
  return retainedClasses.has(className) || retainedPatterns.some((pattern) => pattern.test(className));
}

function isBootstrapClass(className) {
  return bootstrapClassPatterns.some((pattern) => pattern.test(className));
}

function scanPug(source, displayPath) {
  const filename = path.resolve(displayPath);
  return collectPugClasses(source, filename)
    .filter(({ className }) => isBootstrapClass(className) && !isRetained(className))
    .map(({ className, line }) => ({ file: displayPath, line, className }));
}

function checkFixtures() {
  const accepted = fs.readFileSync(path.join(fixturesRoot, 'retained-classes.pug'), 'utf8');
  assert.deepEqual(scanPug(accepted, 'qa/fixtures/bootstrap-classes/retained-classes.pug'), []);

  const rejectedPath = 'qa/fixtures/bootstrap-classes/unapproved-utility.pug';
  const rejected = fs.readFileSync(path.join(fixturesRoot, 'unapproved-utility.pug'), 'utf8');
  const issues = scanPug(rejected, rejectedPath);
  assert.ok(issues.some((issue) => issue.className === 'd-flex' && issue.line === 1), 'fixture must identify a disallowed Bootstrap utility with its source line');
  assert.ok(issues.some((issue) => issue.className === 'text-primary' && issue.line === 1), 'fixture must detect more than one utility family');
  assert.ok(issues.some((issue) => issue.className === 'list-inline' && issue.line === 1), 'fixture must detect Bootstrap list utilities outside the retained surface');
}

function main() {
  checkFixtures();
  const files = walkFiles(sourceRoot).sort();
  const issues = files.flatMap((file) => {
    const relative = path.relative(repoRoot, file).split(path.sep).join('/');
    return scanPug(fs.readFileSync(file, 'utf8'), relative);
  });
  if (issues.length) {
    process.stderr.write(`Bootstrap class check found ${issues.length} unapproved class(es):\n`);
    for (const issue of issues) process.stderr.write(`- ${issue.file}:${issue.line}: .${issue.className}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`Bootstrap class check passed: ${files.length} Pug templates; retained surface and negative fixture verified.\n`);
}

main();
