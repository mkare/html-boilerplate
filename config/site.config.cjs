const path = require('node:path');
const { normalizeBasePath, normalizeAssetBase, normalizeSiteUrl } = require('../build/helpers/urls.cjs');
const { loadProjectOverrides, DEFAULT_EXTERNAL_NAVIGATION } = require('../build/overrides/project-overrides.cjs');

const DEFAULT_LOCALE_BY_DEMO = Object.freeze(Object.assign(Object.create(null), { agency: 'en', saas: 'en' }));

function normalizeDefaultLocale(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('DEFAULT_LOCALE must be a BCP-47 language tag.');
  try {
    const [locale] = Intl.getCanonicalLocales(value.trim());
    if (locale) return locale;
  } catch {
    // Fall through to the project-specific error below for invalid tags.
  }
  throw new Error(`DEFAULT_LOCALE must be a BCP-47 language tag; received "${value}".`);
}

function getSiteConfig(env = process.env, repoRoot = path.resolve(__dirname, '..')) {
  const basePath = normalizeBasePath(env.BASE_PATH || '/');
  const assetBase = normalizeAssetBase(env.ASSET_BASE || basePath);
  const siteUrl = normalizeSiteUrl(env.SITE_URL || '');
  const demoId = String(env.BUILD_DEMO || env.DEMO_ID || env.demo || 'saas').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(demoId)) throw new Error(`BUILD_DEMO must be a lowercase demo id; received "${demoId}".`);
  const defaultLocale = normalizeDefaultLocale(env.DEFAULT_LOCALE || DEFAULT_LOCALE_BY_DEMO[demoId] || 'en');
  const defaultLocales = Object.freeze({ ...DEFAULT_LOCALE_BY_DEMO, [demoId]: defaultLocale });
  const projectOverrides = loadProjectOverrides({ repoRoot, demoId });

  return Object.freeze({
    siteUrl,
    basePath,
    assetBase,
    demoId,
    defaultLocale,
    defaultLocales,
    projectOverrides,
    externalNavigation: Object.freeze(projectOverrides.navigation.external || DEFAULT_EXTERNAL_NAVIGATION.map((item) => ({ ...item }))),
  });
}

module.exports = { getSiteConfig, normalizeDefaultLocale, DEFAULT_LOCALE_BY_DEMO };
