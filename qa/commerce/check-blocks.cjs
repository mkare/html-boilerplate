const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pug = require('pug');
const { assertProps } = require('../../build/helpers/assert-props.cjs');

const root = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const fixture = path.join(__dirname, 'commerce-block-fixture.pug');

function include(relative) {
  const target = path.join(root, relative);
  return `include ${path.relative(path.dirname(fixture), target).split(path.sep).join('/')}`;
}

function render(relativeBlocks, content, locals = {}) {
  const source = [...relativeBlocks.map(include), content].join('\n\n');
  return pug.render(source, { filename: fixture, assertProps, ...locals });
}

const categoryData = [
  { label: 'All <pieces>', value: 'all' },
  { label: 'Desk & work', value: 'desk' },
];
const colorData = [{ label: 'Sky blue', value: 'sky', swatch: 'sky' }];
const product = {
  id: 'desk-lamp',
  name: '<script>lamp</script>',
  description: 'A & B',
  category: 'desk',
  rating: '4.8',
  reviews: 16,
  art: 'lamp',
  tone: '#c7d2fe',
  shadow: '#6366f1',
  stock: 'ready',
  isNew: true,
  pageId: 'commerce.product.desk-lamp',
  currency: 'USD',
  priceMinor: 12000,
};

const catalogHtml = render(
  [
    'src/blocks/commerce/catalog-filter/catalog-filter.pug',
    'src/blocks/commerce/product-card/product-card.pug',
  ],
  [
    '+commerceCatalogFilter({ categories, colors })',
    '  .store-products-region',
    '    .store-product-grid#store-product-grid',
    '      +commerceProductCard({ product, detailHref: "/commerce/product/desk-lamp/", price: "$120.00", compareAtPrice: "" })',
  ].join('\n'),
  { categories: categoryData, colors: colorData, product },
);
assert.match(catalogHtml, /<div class="store-category-rail" role="toolbar" aria-label="Shop by collection">/);
assert.match(catalogHtml, /data-category-chip="all" aria-pressed="true">All &lt;pieces&gt;<\/button>/);
assert.match(catalogHtml, /<aside class="store-filter-panel" id="store-filter-panel" aria-label="Product filters">/);
assert.match(catalogHtml, /<div class="store-catalog__layout">[\s\S]*<aside class="store-filter-panel"[\s\S]*<div class="store-products-region">/);
for (const selector of [
  'data-category-chip',
  'data-store-search',
  'data-store-sort',
  'data-filter-toggle',
  'data-filter-category',
  'data-filter-color',
  'data-filter-stock',
  'data-filter-price',
  'data-reset-filters',
]) {
  assert.match(catalogHtml, new RegExp(selector), `catalog filter retains [${selector}]`);
}
assert.match(catalogHtml, /<article class="store-product" data-product-id="desk-lamp">/);
assert.match(catalogHtml, /&lt;script&gt;lamp&lt;\/script&gt;/, 'product copy is escaped');
assert.doesNotMatch(catalogHtml, /<script>lamp<\/script>/, 'product name cannot inject markup');
assert.match(catalogHtml, /data-quick-view="desk-lamp"/);
assert.match(catalogHtml, /data-add-product="desk-lamp"/);
assert.match(catalogHtml, /href="\/commerce\/product\/desk-lamp\/"/);
assert.match(catalogHtml, /Rated 4\.8 out of 5 from 16 reviews/);
assert.throws(() => render(
  ['src/blocks/commerce/catalog-filter/catalog-filter.pug'],
  '+commerceCatalogFilter({ categories, colors })',
  { categories: categoryData, colors: colorData },
), /requires a nested product results block/);
assert.throws(() => render(
  ['src/blocks/commerce/product-card/product-card.pug'],
  '+commerceProductCard({ product, detailHref: "/x/", price: "$1", unknown: true })',
  { product },
), /unknown prop "unknown"/);
const hrefFixture = (detailHref) => render(
  ['src/blocks/commerce/product-card/product-card.pug'],
  `+commerceProductCard({ product, detailHref: ${JSON.stringify(detailHref)}, price: "$1" })`,
  { product },
);
for (const href of ['/products/lamp/', '../products/lamp/', '#details', '?view=compact', 'https://shop.example/lamp', 'http://shop.example/lamp', 'mailto:shop@example.test', 'tel:+12025550100']) {
  assert.doesNotThrow(() => hrefFixture(href), `detailHref accepts ${href}`);
}
for (const href of [
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  '//evil.example/path',
  '\\\\evil.example/path',
  ' https://shop.example/lamp',
  '\u00a0https://shop.example/lamp',
  'https:///missing-host',
  'https:shop.example/lamp',
]) {
  assert.throws(() => hrefFixture(href), /detailHref must be a safe relative URL or use http, https, mailto, or tel/, `detailHref rejects ${href}`);
}
for (const color of ['#12345', '#abcd123', '#12', '#ggg']) {
  for (const property of ['tone', 'shadow']) {
    const invalidProduct = { ...product, [property]: color };
    assert.throws(() => render(
      ['src/blocks/commerce/product-card/product-card.pug'],
      '+commerceProductCard({ product, detailHref: "/products/lamp/", price: "$1" })',
      { product: invalidProduct },
    ), /tone and shadow must be 3, 4, 6, or 8 digit hex colors/);
  }
}
for (const color of ['#abc', '#abcd', '#a1b2c3', '#a1b2c3d4']) {
  const coloredProduct = { ...product, tone: color, shadow: color };
  assert.doesNotThrow(() => render(
    ['src/blocks/commerce/product-card/product-card.pug'],
    '+commerceProductCard({ product, detailHref: "/products/lamp/", price: "$1" })',
    { product: coloredProduct },
  ), `product card accepts ${color}`);
}

const quickViewHtml = render(
  ['src/blocks/commerce/quick-view/quick-view.pug'],
  '+commerceQuickView({ title: "<Lamp & shade>", description: "Safe & soft", quantityLabel: "Count", quantityGroupLabel: "Select a count" })',
);
assert.match(quickViewHtml, /<dialog class="store-quick-view" id="quick-view-dialog" aria-labelledby="quick-view-title">/);
assert.match(quickViewHtml, /id="quick-view-art"/);
assert.match(quickViewHtml, /<h2 id="quick-view-title">&lt;Lamp &amp; shade&gt;<\/h2>/);
assert.match(quickViewHtml, /aria-label="Select a count"/);
assert.match(quickViewHtml, /class="store-quantity-control" role="group" aria-label="Select a count"/);
assert.match(quickViewHtml, />Count<\/span>/);
for (const id of [
  'quick-view-dialog',
  'quick-view-art',
  'quick-view-category',
  'quick-view-title',
  'quick-view-description',
  'quick-view-rating',
  'quick-view-reviews',
  'quick-view-price',
  'quick-view-compare',
  'quick-view-availability',
  'quick-view-quantity',
  'quick-view-add',
]) {
  assert.match(quickViewHtml, new RegExp(`id="${id}"`), `quick view retains #${id}`);
}
assert.equal((quickViewHtml.match(/data-quick-view-adjust=/g) || []).length, 2);
for (const color of ['#12345', '#abcd123', '#12', '#ggg']) {
  for (const property of ['tone', 'shadow']) {
    assert.throws(() => render(
      ['src/blocks/commerce/quick-view/quick-view.pug'],
      `+commerceQuickView({ ${property}: ${JSON.stringify(color)} })`,
    ), /tone\/shadow must be valid hex colors/);
  }
}
for (const color of ['#abc', '#abcd', '#a1b2c3', '#a1b2c3d4']) {
  assert.doesNotThrow(() => render(
    ['src/blocks/commerce/quick-view/quick-view.pug'],
    `+commerceQuickView({ tone: ${JSON.stringify(color)}, shadow: ${JSON.stringify(color)} })`,
  ), `quick view accepts ${color}`);
}

const cartHtml = render(
  ['src/blocks/commerce/cart-drawer/cart-drawer.pug'],
  '+commerceCartDrawer({ title: "<Bag & more>", emptyTitle: "<Empty>", checkoutLabel: "Preview & pay" })',
);
assert.match(cartHtml, /<dialog class="store-cart" id="store-cart" aria-labelledby="store-cart-title">/);
assert.match(cartHtml, /<h2 id="store-cart-title">&lt;Bag &amp; more&gt; <span data-cart-count="data-cart-count">0<\/span><\/h2>/);
assert.match(cartHtml, /<h3>&lt;Empty&gt;<\/h3>/);
for (const id of [
  'store-cart',
  'store-cart-title',
  'store-cart-announcement',
  'store-cart-items',
  'store-cart-empty',
  'store-cart-footer',
  'store-shipping-copy',
  'store-shipping-progress',
  'store-cart-subtotal',
]) {
  assert.match(cartHtml, new RegExp(`id="${id}"`), `cart retains #${id}`);
}
assert.match(cartHtml, /data-cart-count="data-cart-count"/);
assert.match(cartHtml, /id="store-cart-announcement" role="status" aria-live="polite"/);
assert.match(cartHtml, /id="store-cart-footer" hidden/);
assert.match(cartHtml, /data-demo-checkout="data-demo-checkout">Preview &amp; pay<\/button>/);
assert.match(read('src/views/commerce/_catalog.pug'), /data-open-cart/);

for (const [partial, mixin] of [
  ['src/views/commerce/_catalog.pug', 'commerceCatalogFilter'],
  ['src/views/commerce/_catalog.pug', 'commerceProductCard'],
  ['src/views/commerce/_catalog-dialogs.pug', 'commerceQuickView'],
  ['src/views/commerce/_catalog-dialogs.pug', 'commerceCartDrawer'],
]) {
  assert.match(read(partial), new RegExp(`\\+${mixin}\\(`), `${partial} composes ${mixin}`);
}
assert.doesNotMatch(read('src/views/commerce/_catalog.pug'), /article\.store-product\(/, 'catalog product markup is delegated to the card block');
assert.doesNotMatch(read('src/views/commerce/_catalog-dialogs.pug'), /dialog\.store-(?:quick-view|cart)#/, 'dialogs are delegated to their blocks');

process.stdout.write('Commerce block contracts passed: filter, product card, quick view, cart dialog, escaped output, and controller selectors.\n');
