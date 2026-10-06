#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const parse5 = require('parse5');

const root = path.resolve(__dirname, '../..');
const distRoot = path.join(root, 'dist');
const manifestPath = path.join(root, '.generated/pages-manifest.json');
const failures = [];

function fail(page, message) {
  failures.push(page + ': ' + message);
}

function attr(node, name) {
  return node.attrs?.find((entry) => entry.name === name)?.value ?? null;
}

function walk(node, visit, ancestors = []) {
  if (node.tagName) visit(node, ancestors);
  const next = node.tagName ? [...ancestors, node] : ancestors;
  for (const child of node.childNodes || []) walk(child, visit, next);
  if (node.content) walk(node.content, visit, next);
}

function textContent(node) {
  if (node.nodeName === '#text') return node.value || '';
  return (node.childNodes || []).map(textContent).join(' ');
}

function hasName(node, ids) {
  const ariaLabel = attr(node, 'aria-label');
  if (ariaLabel?.trim()) return true;
  const labelledBy = attr(node, 'aria-labelledby');
  if (labelledBy?.trim() && labelledBy.split(/\s+/).every((id) => ids.has(id))) return true;
  if (attr(node, 'title')?.trim()) return true;
  if (textContent(node).replace(/\s+/g, ' ').trim()) return true;
  let alternative = false;
  walk(node, (child) => {
    if (child.tagName === 'img' && attr(child, 'alt')?.trim()) alternative = true;
  });
  return alternative;
}

function inspectPage(page) {
  const output = page.output;
  const absolute = path.join(distRoot, output);
  if (!fs.existsSync(absolute)) {
    fail(output, 'manifest HTML output is missing.');
    return;
  }
  const document = parse5.parse(fs.readFileSync(absolute, 'utf8'));
  const nodes = [];
  walk(document, (node, ancestors) => nodes.push({ node, ancestors }));

  const idNodes = new Map();
  for (const { node } of nodes) {
    const id = attr(node, 'id');
    if (!id) continue;
    if (idNodes.has(id)) fail(output, 'duplicate id="' + id + '".');
    else idNodes.set(id, node);
  }

  const html = nodes.find(({ node }) => node.tagName === 'html')?.node;
  if (!attr(html || {}, 'lang')?.trim()) fail(output, 'html element needs a page language.');
  const mains = nodes.filter(({ node }) => node.tagName === 'main');
  if (mains.length !== 1 || attr(mains[0]?.node || {}, 'id') !== 'siteMain') fail(output, 'document needs one main#siteMain landmark.');
  const skipLink = nodes.some(({ node }) => node.tagName === 'a' && attr(node, 'href') === '#siteMain');
  if (!skipLink) fail(output, 'document needs a skip link targeting #siteMain.');

  const headings = nodes.filter(({ node }) => /^h[1-6]$/.test(node.tagName || ''));
  const h1Count = headings.filter(({ node }) => node.tagName === 'h1').length;
  if (h1Count !== 1) fail(output, 'expected one primary h1; found ' + h1Count + '.');
  let previousLevel = 0;
  for (const { node } of headings) {
    const level = Number(node.tagName.slice(1));
    if (previousLevel && level > previousLevel + 1) fail(output, 'heading order skips from h' + previousLevel + ' to h' + level + '.');
    previousLevel = level;
  }

  for (const { node, ancestors } of nodes) {
    if (node.tagName === 'img' && attr(node, 'alt') === null) fail(output, 'img is missing an alt attribute.');
    if (node.tagName === 'input' && (attr(node, 'type') || '').toLowerCase() === 'image' && !attr(node, 'alt')?.trim()) {
      fail(output, 'image input is missing alternative text.');
    }
    if (node.tagName === 'a' && attr(node, 'href') !== null && !hasName(node, idNodes)) {
      fail(output, 'link has no accessible name.');
    }
    if (node.tagName === 'button' && !hasName(node, idNodes)) fail(output, 'button has no accessible name.');

    if (['input', 'select', 'textarea'].includes(node.tagName)) {
      const type = (attr(node, 'type') || '').toLowerCase();
      if (!['hidden', 'button', 'submit', 'reset', 'image'].includes(type)) {
        const id = attr(node, 'id');
        const labelled = Boolean(attr(node, 'aria-label')?.trim()
          || (attr(node, 'aria-labelledby') || '').split(/\s+/).some((reference) => idNodes.has(reference))
          || (id && nodes.some(({ node: candidate }) => candidate.tagName === 'label' && attr(candidate, 'for') === id))
          || ancestors.some((ancestor) => ancestor.tagName === 'label'));
        if (!labelled) fail(output, node.tagName + (id ? '#' + id : '') + ' has no associated label.');
      }
    }

    for (const referenceName of ['aria-controls', 'aria-describedby', 'aria-labelledby', 'aria-owns', 'aria-details']) {
      const references = attr(node, referenceName);
      if (references && references.split(/\s+/).some((id) => id && !idNodes.has(id))) {
        fail(output, referenceName + ' references a missing id: "' + references + '".');
      }
    }
  }
}

function main() {
  if (!fs.existsSync(manifestPath) || !fs.existsSync(distRoot)) {
    process.stderr.write('Build dist/ first so the accessibility markup check can read the generated pages.\n');
    process.exitCode = 1;
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const page of manifest.pages || []) inspectPage(page);
  if (failures.length) {
    process.stderr.write('Accessibility markup check found ' + failures.length + ' issue(s):\n' + failures.map((item) => '- ' + item).join('\n') + '\n');
    process.exitCode = 1;
    return;
  }
  process.stdout.write('Accessibility markup checks passed for ' + (manifest.pages || []).length + ' pages: lang, landmark, skip link, heading order, image alternatives, control names/labels, and ARIA references. This is a static subset of WCAG checks, not a full conformance claim.\n');
}

main();
