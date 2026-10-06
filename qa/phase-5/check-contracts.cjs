const assert = require('node:assert/strict');
const {
  assertUniquePageIds,
  attachHreflangAlternates,
  loadPages,
  materializeProfilePages,
  registerOutput,
  toOutputPath,
  validateRecord,
} = require('../../build/pages/manifest.cjs');

function expectError(callback, pattern, label) {
  assert.throws(callback, pattern, label);
}

expectError(() => toOutputPath('/safe/%2e%2e/escape/'), /invalid path segment|invalid/i, 'reject encoded traversal in route');
expectError(() => validateRecord({ id: 'bad.locale', route: '/', source: 'build/pages/404.pug', title: 'Bad locale', locale: '' }), /locale/, 'reject invalid page data');
expectError(() => assertUniquePageIds([
  { id: 'Saas.Home', source: 'one.json' },
  { id: 'saas.home', source: 'two.json' },
]), /Duplicate page id after normalization/, 'reject normalized duplicate IDs');

const owners = new Map();
registerOutput(owners, 'about/index.html', 'page legacy.about');
expectError(() => registerOutput(owners, 'ABOUT/INDEX.HTML', 'page agency.about'), /Output collision/, 'reject normalized duplicate outputs');

expectError(() => attachHreflangAlternates([
  { id: 'docs.en', translationKey: 'docs', translationLocales: ['en', 'tr'], locale: 'en', route: '/docs/', output: 'docs/index.html' },
], { siteUrl: 'https://theme.example', basePath: '/' }, 'customer-production'), /Translation target missing/, 'reject a missing declared translation target');

const catalog = loadPages({
  buildNow: '2026-10-01T00:00:00.000Z',
  site: { siteUrl: 'https://theme.example', basePath: '/preview/theme/', assetBase: '/preview/theme/', demoId: 'saas' },
  profile: 'catalog-preview',
});
assert(catalog.pages.some((page) => page.id === 'legacy.home' && page.route === '/'), 'catalog preview retains the root framework homepage');
for (const demoId of ['agency', 'saas']) {
  assert(catalog.pages.some((page) => page.demoId === demoId && page.demoHome && page.route === `/demos/${demoId}/`), `catalog preview mounts ${demoId} at /demos/${demoId}/`);
}

const customer = loadPages({
  buildNow: '2026-10-01T00:00:00.000Z',
  site: { siteUrl: 'https://theme.example', basePath: '/preview/theme/', assetBase: '/preview/theme/', demoId: 'saas' },
  profile: 'customer-production',
});
const starter = loadPages({
  buildNow: '2026-10-01T00:00:00.000Z',
  site: { siteUrl: 'https://theme.example', basePath: '/preview/theme/', assetBase: '/preview/theme/', demoId: 'saas' },
  profile: 'starter',
});
assert.equal(customer.pages.filter((page) => page.demoHome).length, 1, 'customer build has one selected demo home');
assert.equal(customer.pages.find((page) => page.demoHome).route, '/', 'customer home mounts at /');
assert(!customer.pages.some((page) => page.demoId === 'agency'), 'SaaS customer build excludes Agency');
assert(!starter.pages.some((page) => page.id.startsWith('blog.')), 'SaaS starter excludes blog instances');
assert(starter.pages.every((page) => page.id === 'system.404' || page.starter || (page.requiredByDemos || []).includes('saas')), 'starter includes only starter-approved pages and dependencies');
assert.equal(starter.pages.find((page) => page.id === 'system.404')._pugData.homePageId, 'saas.home', 'customer 404 returns to the selected package');

const mountedFixture = materializeProfilePages([
  { id: 'saas.home', source: 'home.pug', route: '/', output: 'index.html', title: 'Orbit', locale: 'en', demoId: 'saas', demoHome: true },
  { id: 'saas.features', source: 'features.pug', route: '/features/', output: 'features/index.html', title: 'Features', locale: 'en', demoId: 'saas' },
  { id: 'agency.home', source: 'agency.pug', route: '/', output: 'index.html', title: 'Fieldwork', locale: 'en', demoId: 'agency', demoHome: true },
  { id: 'system.404', source: '404.pug', route: '/404/', output: '404.html', title: '404', locale: 'en' },
], { profile: 'catalog-preview', demoId: 'saas', site: { siteUrl: null, basePath: '/preview/theme/' } });
assert.equal(mountedFixture.find((page) => page.id === 'saas.home').output, 'demos/saas/index.html', 'mounting recalculates output paths');
assert.equal(mountedFixture.find((page) => page.id === 'system.404').output, '404.html', 'system 404 retains its top-level output');
assert.equal(mountedFixture.find((page) => page.id === 'agency.home')._pugData.homePageId, 'agency.home', 'catalog pages receive their own package homepage ID');

process.stdout.write(`Phase 5 manifest contracts passed: preview ${catalog.pages.length} pages, SaaS customer ${customer.pages.length}, starter ${starter.pages.length}; invalid locale, normalized IDs/outputs, missing translation target, selected-home, and route-mount assertions verified.\n`);
