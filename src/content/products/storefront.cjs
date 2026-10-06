const records = require('./products.cjs');

const products = records.map((product) => ({
  ...product,
  pageId: `commerce.product.${product.id}`,
}));

const categories = [
  { label: 'All pieces', value: 'all' },
  { label: 'Home', value: 'home' },
  { label: 'Desk', value: 'desk' },
  { label: 'Living', value: 'living' },
  { label: 'Travel', value: 'travel' },
];

const colors = [
  { label: 'Sky blue', value: 'sky', swatch: 'sky' },
  { label: 'Soft clay', value: 'clay', swatch: 'clay' },
  { label: 'Leaf green', value: 'sage', swatch: 'sage' },
  { label: 'Inky dark', value: 'ink', swatch: 'ink' },
];

const pageSize = 5;
const currencyDigits = (currency) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency,
}).resolvedOptions().maximumFractionDigits;
const formatPrice = (minor, currency = 'USD') => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency,
}).format(minor / (10 ** currencyDigits(currency)));

module.exports = { products, categories, colors, pageSize, formatPrice };
