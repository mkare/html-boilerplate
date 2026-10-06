#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pug = require('pug');
const { getSiteConfig, normalizeDefaultLocale } = require('../../config/site.config.cjs');
const { createRouteHelper } = require('../../build/helpers/urls.cjs');
const { REPO_ROOT, loadPages, materializeProfilePages } = require('../../build/pages/manifest.cjs');

const buildNow = '2026-10-04T00:00:00.000Z';
const site = {
  siteUrl: 'https://theme.example',
  basePath: '/preview/theme/',
  assetBase: '/preview/theme/',
  demoId: 'saas',
  defaultLocale: 'en',
  defaultLocales: { saas: 'en', agency: 'tr' },
};

assert.equal(normalizeDefaultLocale('pt-br'), 'pt-BR', 'default locale is normalized to BCP-47 casing');
assert.throws(() => normalizeDefaultLocale('not_a_locale'), /BCP-47/, 'invalid default locale is rejected');
const siteConfig = getSiteConfig({ BUILD_DEMO: 'saas' }, REPO_ROOT);
assert.equal(siteConfig.defaultLocale, 'en', 'SaaS has an explicit default locale');
assert.equal(siteConfig.defaultLocales.agency, 'en', 'every built-in demo has a locale default');
const localeOverride = getSiteConfig({ BUILD_DEMO: 'saas', DEFAULT_LOCALE: 'tr' }, REPO_ROOT);
assert.equal(localeOverride.defaultLocale, 'tr', 'a customer can configure its selected site default locale');
assert.equal(localeOverride.defaultLocales.agency, 'en', 'overriding one demo does not change another demo default');

const fixturePages = [
  { id: 'saas.home', route: '/', output: 'index.html', title: 'Home', locale: 'en', demoId: 'saas', demoHome: true },
  { id: 'saas.about.en', route: '/about/', output: 'about/index.html', title: 'About', locale: 'en', demoId: 'saas', translationKey: 'saas.about', translationLocales: ['en', 'tr'] },
  { id: 'saas.about.tr', route: '/about/', output: 'about/index.html', title: 'About', locale: 'tr', demoId: 'saas', translationKey: 'saas.about', translationLocales: ['en', 'tr'] },
  { id: 'agency.home', route: '/', output: 'index.html', title: 'Studio', locale: 'tr', demoId: 'agency', demoHome: true },
  { id: 'agency.about.en', route: '/about/', output: 'about/index.html', title: 'Studio', locale: 'en', demoId: 'agency' },
  { id: 'system.404', route: '/404/', output: '404.html', title: 'Not found', locale: 'en' },
];

const catalog = materializeProfilePages(fixturePages, { profile: 'catalog-preview', demoId: 'saas', site });
const catalogSaasEn = catalog.find((page) => page.id === 'saas.about.en');
const catalogSaasTr = catalog.find((page) => page.id === 'saas.about.tr');
assert.equal(catalogSaasEn.route, '/demos/saas/about/', 'default locale has no locale segment under the demo mount');
assert.equal(catalogSaasTr.route, '/demos/saas/tr/about/', 'non-default locale sits after the demo mount');
assert.equal(catalog.find((page) => page.id === 'agency.home').route, '/demos/agency/', 'each demo uses its own default locale');
assert.equal(catalog.find((page) => page.id === 'agency.about.en').route, '/demos/agency/en/about/', 'another demo receives its own non-default prefix');
assert.deepEqual(catalogSaasEn._pugData.hreflangAlternates, [{
  locale: 'tr', href: 'https://theme.example/preview/theme/demos/saas/tr/about/',
}], 'catalog hreflang uses the demo mount, locale route, and deployment base path');
assert.deepEqual(catalogSaasTr._pugData.hreflangAlternates, [{
  locale: 'en', href: 'https://theme.example/preview/theme/demos/saas/about/',
}], 'hreflang alternates are reciprocal');
const catalogRoute = createRouteHelper(catalog, site);
assert.equal(catalogRoute('saas.about.tr'), '/preview/theme/demos/saas/tr/about/');

const customer = materializeProfilePages(fixturePages, { profile: 'customer-production', demoId: 'saas', site });
const customerEn = customer.find((page) => page.id === 'saas.about.en');
const customerTr = customer.find((page) => page.id === 'saas.about.tr');
assert.equal(customer.find((page) => page.id === 'saas.home').route, '/', 'selected demo default homepage stays at site root');
assert.equal(customerEn.route, '/about/', 'customer default locale remains unprefixed');
assert.equal(customerTr.route, '/tr/about/', 'customer non-default locale is prefixed at site root');
assert.equal(customer.find((page) => page.id === 'system.404')._pugData.homePageId, 'saas.home');
const customerRoute = createRouteHelper(customer, site);
assert.equal(customerRoute('saas.about.tr'), '/preview/theme/tr/about/', 'basePath composes once with locale prefix');
assert.equal(customerEn._pugData.hreflangAlternates[0].href, 'https://theme.example/preview/theme/tr/about/');
assert.throws(() => materializeProfilePages(fixturePages, {
  profile: 'customer-production', demoId: 'saas',
  site: { ...site, defaultLocale: 'tr', defaultLocales: { ...site.defaultLocales, saas: 'tr' } },
}), /defaultLocale "tr" must match its demoHome locale "en"/, 'a site default cannot move an untranslated English homepage off /');

const switcherPath = path.join(REPO_ROOT, 'src/content/locales/switcher.pug');
const switcher = pug.renderFile(switcherPath, { locale: 'en', hreflangAlternates: customerEn._pugData.hreflangAlternates });
assert.match(switcher, /role="group"/);
assert.match(switcher, /English/);
assert.match(switcher, /href="https:\/\/theme\.example\/preview\/theme\/tr\/about\/"/);
assert.match(switcher, /Türkçe/);
assert.equal(pug.renderFile(switcherPath, { locale: 'en', hreflangAlternates: [] }).trim(), '', 'no language switcher appears without a real translated counterpart');
const sharedHeader = fs.readFileSync(path.join(REPO_ROOT, 'src/components/header.pug'), 'utf8');
const agencyNavigation = fs.readFileSync(path.join(REPO_ROOT, 'src/pages/agency/_agency-navigation.pug'), 'utf8');
assert.match(sharedHeader, /include @content\/locales\/switcher\.pug/, 'shared site layouts include the language switcher');
assert.match(agencyNavigation, /include @content\/locales\/switcher\.pug/, 'Agency navigation includes the same switcher');

const realCatalog = loadPages({ buildNow, site: { ...site, defaultLocales: { saas: 'en', agency: 'en' } }, profile: 'catalog-preview' });
assert(realCatalog.pages.every((page) => !page._pugData?.hreflangAlternates), 'current English-only content does not invent translated targets');

process.stdout.write('Locale contracts passed: default locale config, demo mount, customer root/subpath, reciprocal hreflang, visible switcher fixture, and no synthetic translations.\n');
