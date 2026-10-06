const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pug = require('pug');
const { parseFragment } = require('parse5');
const { assertProps } = require('../../build/helpers/assert-props.cjs');
const { createRouteHelper } = require('../../build/helpers/urls.cjs');
const legacyPages = require('../../build/pages/legacy.cjs');

const repoRoot = path.resolve(__dirname, '../..');
const fixturePath = path.join(__dirname, 'fixture.pug');
const componentFiles = [
  'src/ui/atoms/badge/badge.pug',
  'src/ui/atoms/link/link.pug',
  'src/ui/molecules/alert/alert.pug',
  'src/ui/molecules/card/card.pug',
  'src/ui/molecules/choice-group/choice-group.pug',
  'src/ui/molecules/select/select.pug',
].map((relativePath) => path.join(repoRoot, relativePath));
const includeSource = componentFiles
  .map((file) => `include ${path.relative(path.dirname(fixturePath), file).split(path.sep).join('/')}`)
  .join('\n');
const route = createRouteHelper(legacyPages, { basePath: '/' });

for (const file of componentFiles) {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /&&/, `${path.relative(repoRoot, file)} must avoid && because PugPlugin rewrites ampersands before client compilation`);
}

function render(source) {
  return pug.render(`${includeSource}\n${source}`, {
    filename: fixturePath,
    basedir: repoRoot,
    assertProps,
    route,
  });
}

function attribute(node, name) {
  return node.attrs?.find((item) => item.name === name)?.value;
}

function textContent(node) {
  if (node.nodeName === '#text') return node.value;
  return (node.childNodes || []).map(textContent).join('');
}

function findAll(node, predicate, found = []) {
  if (node.tagName && predicate(node)) found.push(node);
  for (const child of node.childNodes || []) findAll(child, predicate, found);
  return found;
}

function byId(tree, id) {
  return findAll(tree, (node) => attribute(node, 'id') === id)[0];
}

function expectsInvalidMarkup(source, pattern) {
  assert.throws(() => render(source), pattern);
}

const html = render(`
+uiLink({ href: route('legacy.markdown'), label: '<Read documentation>' })
+uiSelect({ id: 'topic-select', name: 'topic', label: 'Topic', value: 'a11y', options: [{ value: 'design', label: 'Design' }, { value: 'a11y', label: 'Accessibility' }], hint: 'Choose a topic.' })
+uiChoiceGroup({ idPrefix: 'topics', name: 'topics', legend: 'Topics', type: 'checkbox', items: [{ value: 'design', label: 'Design systems', checked: true }, { value: 'a11y', label: 'Accessibility', disabled: true }], hint: 'Choose any topics.' })
+uiChoiceGroup({ idPrefix: 'frequency', name: 'frequency', legend: 'Frequency', type: 'radio', items: [{ value: 'weekly', label: 'Weekly', checked: true }, { value: 'monthly', label: 'Monthly' }], required: true })
+uiBadge({ label: 'Ready', variant: 'success', dot: true })
+uiAlert({ variant: 'error', title: 'Save failed', message: 'Try again.', icon: '!' })
+uiCard({ title: 'Release notes', eyebrow: 'Updates', description: 'Recent changes.', variant: 'raised' })
  +uiLink({ href: '/components/', label: 'Open the catalog' })
`);
const tree = parseFragment(html);

const links = findAll(tree, (node) => node.tagName === 'a' && attribute(node, 'class') === 'ui-link');
assert.equal(links.length, 2, 'link and card examples should render native anchors');
assert.equal(attribute(links[0], 'href'), '/markdown/', 'the real legacy route should reach the link href');
assert.equal(attribute(links[0], 'target'), undefined, 'links should leave browsing-context policy to the page');
assert.equal(findAll(tree, (node) => node.tagName === 'script').length, 0, 'link labels must be escaped');
assert.match(textContent(links[0]), /<Read documentation>/, 'escaped link label should remain visible text');
assert.equal(findAll(links[0], (node) => attribute(node, 'aria-hidden') === 'true').length, 1, 'decorative arrow should be hidden from assistive technology');
const externalLinks = findAll(parseFragment(render(`
+uiLink({ href: 'https://example.test/docs', label: 'External docs' })
+uiLink({ href: 'mailto:help@example.test', label: 'Email support' })
+uiLink({ href: 'tel:+15550100', label: 'Call support' })
`)), (node) => node.tagName === 'a');
assert.deepEqual(externalLinks.map((node) => attribute(node, 'href')), ['https://example.test/docs', 'mailto:help@example.test', 'tel:+15550100']);

const topicLabel = findAll(tree, (node) => node.tagName === 'label' && attribute(node, 'for') === 'topic-select')[0];
const topicSelect = byId(tree, 'topic-select');
assert.ok(topicLabel && topicSelect, 'select should have an explicit visible label');
assert.equal(attribute(topicSelect, 'aria-describedby'), 'topic-select-hint');
assert.equal(findAll(tree, (node) => node.tagName === 'option' && attribute(node, 'selected') !== undefined).length, 1, 'select should emit one selected option');

const checkboxGroup = findAll(tree, (node) => node.tagName === 'fieldset' && findAll(node, (child) => child.tagName === 'legend' && textContent(child) === 'Topics').length > 0)[0];
const checkboxInputs = findAll(checkboxGroup, (node) => node.tagName === 'input');
assert.equal(findAll(checkboxGroup, (node) => node.tagName === 'legend').length, 1, 'choice group should use a fieldset and legend');
assert.equal(attribute(checkboxGroup, 'aria-describedby'), 'topics-hint', 'group hint should describe the fieldset');
assert.equal(attribute(checkboxInputs[0], 'type'), 'checkbox');
assert.equal(attribute(checkboxInputs[0], 'checked'), 'checked');
assert.equal(attribute(checkboxInputs[1], 'disabled'), 'disabled');
const disabledChoice = findAll(checkboxGroup, (node) => node.tagName === 'label' && attribute(node, 'for') === attribute(checkboxInputs[1], 'id'))[0];
assert.ok(attribute(disabledChoice, 'class')?.includes('--disabled'), 'disabled choices should be styled explicitly');
for (const input of checkboxInputs) {
  const matchingLabel = findAll(checkboxGroup, (node) => node.tagName === 'label' && attribute(node, 'for') === attribute(input, 'id'))[0];
  assert.ok(matchingLabel, `choice ${attribute(input, 'id')} should have an associated label`);
}

const radioInputs = findAll(tree, (node) => node.tagName === 'input' && attribute(node, 'type') === 'radio');
assert.equal(radioInputs.length, 2);
assert.equal(radioInputs.filter((node) => attribute(node, 'required') !== undefined).length, 2, 'required state should use native radio validation');
assert.equal(radioInputs.filter((node) => attribute(node, 'checked') !== undefined).length, 1);

const alert = findAll(tree, (node) => node.tagName === 'div' && attribute(node, 'class')?.includes('ui-alert'))[0];
assert.equal(attribute(alert, 'role'), 'alert');
assert.equal(attribute(alert, 'aria-live'), 'assertive');
assert.equal(attribute(alert, 'aria-atomic'), 'true');

const badge = findAll(tree, (node) => node.tagName === 'span' && attribute(node, 'class')?.includes('ui-badge'))[0];
assert.match(attribute(badge, 'class'), /ui-badge--success/);
assert.equal(findAll(badge, (node) => attribute(node, 'aria-hidden') === 'true').length, 1, 'badge dot should be decorative');
assert.equal(textContent(badge).trim(), 'Ready');

const card = findAll(tree, (node) => node.tagName === 'article' && attribute(node, 'class')?.includes('ui-card'))[0];
assert.ok(card, 'card should use a semantic article');
assert.equal(findAll(card, (node) => node.tagName === 'h3' && textContent(node) === 'Release notes').length, 1);
assert.equal(findAll(card, (node) => node.tagName === 'a').length, 1, 'card body should support interactive content');

expectsInvalidMarkup(`+uiLink({ href: 'javascript:alert(1)', label: 'Unsafe' })`, /safe relative URL/);
expectsInvalidMarkup(`+uiLink({ href: '//example.test/path', label: 'Protocol-relative' })`, /safe relative URL/);
expectsInvalidMarkup(`+uiLink({ href: 'https:example.test/path', label: 'Incomplete external URL' })`, /safe relative URL/);
expectsInvalidMarkup(`+uiLink({ href: 'https://user:pass@example.test/path', label: 'Credential URL' })`, /safe relative URL/);
expectsInvalidMarkup(`+uiLink({ href: '/safe', label: '   ' })`, /visible label/);
expectsInvalidMarkup(`+uiLink({ href: '/safe', label: 'Settings', ariaLabel: '' })`, /visible label/);
expectsInvalidMarkup(`+uiSelect({ id: 'bad id', name: 'topic', label: 'Topic', options: [{ value: 'x', label: 'X' }] })`, /valid id/);
expectsInvalidMarkup(`+uiSelect({ id: 'topic', name: 'topic', label: 'Topic', options: [{ value: 'x', label: 'X' }, { value: 'x', label: 'Duplicate' }] })`, /duplicate option value/);
expectsInvalidMarkup(`+uiSelect({ id: 'topic', name: 'topic', label: 'Topic', value: 'missing', options: [{ value: 'x', label: 'X' }] })`, /does not match an option/);
expectsInvalidMarkup(`+uiChoiceGroup({ idPrefix: 'frequency', name: 'frequency', legend: 'Frequency', type: 'radio', items: [{ value: 'weekly', label: 'Weekly', checked: true }, { value: 'monthly', label: 'Monthly', checked: true }] })`, /at most one checked choice/);
expectsInvalidMarkup(`+uiChoiceGroup({ idPrefix: 'topics', name: 'topics', legend: 'Topics', type: 'checkbox', items: [{ value: 'same', label: 'One' }, { value: 'same', label: 'Two' }] })`, /duplicate choice value/);
expectsInvalidMarkup(`+uiBadge({ label: 'Status', variant: 'unknown' })`, /must be one of/);
expectsInvalidMarkup(`+uiAlert({ message: ' ', variant: 'info' })`, /visible text/);
expectsInvalidMarkup(`+uiCard({ title: 'Card', variant: 'unknown' })`, /must be one of/);

process.stdout.write('shared UI primitive markup and prop acceptance passed.\n');
