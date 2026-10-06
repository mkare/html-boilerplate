const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const legacyPages = require('./legacy.cjs');
const { safeRepoPath } = require('../helpers/urls.cjs');
const { generateBlogCollection } = require('../collections/blog.cjs');

const PAGE_SCHEMA = path.resolve(__dirname, '../../config/schemas/page.schema.json');
const GENERATED_DIR = path.resolve(__dirname, '../../.generated');
const GENERATED_MANIFEST = path.join(GENERATED_DIR, 'pages-manifest.json');
const GENERATED_WRAPPER_DIR = path.join(GENERATED_DIR, 'pages');
const REPO_ROOT = path.resolve(__dirname, '../..');
const KNOWN_LAYOUTS = new Set(['site', 'auth', 'dashboard', 'storefront', 'docs', 'minimal', 'agency', 'legacy']);
const KNOWN_THEMES = new Set(['default', 'commerce']);

function toOutputPath(route) {
  if (route === '/') return 'index.html';
  if (typeof route !== 'string' || !route.startsWith('/') || !route.endsWith('/')) {
    throw new Error(`Page route must be canonical and end in a slash (except "/"): "${route}".`);
  }
  let decoded;
  try { decoded = decodeURIComponent(route); } catch { decoded = null; }
  const routeSegments = route.replace(/^\/+|\/+$/g, '').split('/');
  const decodedSegments = decoded?.replace(/^\/+|\/+$/g, '').split('/');
  if (!decoded || /[?#\\\s]/.test(route) || /[?#\\\s]/.test(decoded) || /%2f|%5c/i.test(route) || route.includes('//') || decoded.includes('//') || routeSegments.some((part) => part === '.' || part === '..' || !part) || decodedSegments?.some((part) => part === '.' || part === '..' || !part)) {
    throw new Error(`Page route contains an invalid path segment: "${route}".`);
  }
  if (route.includes(':')) throw new Error(`Static page routes must be concrete; parameter placeholder found in "${route}".`);
  return `${route.replace(/^\/+|\/+$/g, '')}/index.html`;
}

function collectPageJsonFiles(root) {
  if (!fs.existsSync(root)) return [];
  const found = [];
  const visit = (directory) => {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, item.name);
      if (item.isDirectory()) visit(absolute);
      else if (item.isFile() && item.name === 'page.json') found.push(absolute);
    }
  };
  visit(root);
  return found.sort();
}

function readPageJson(roots) {
  return roots.flatMap((root) => collectPageJsonFiles(root).map((file) => {
    let record;
    try {
      record = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      throw new Error(`Invalid JSON in ${path.relative(REPO_ROOT, file)}: ${error.message}`, { cause: error });
    }
    return { ...record, _manifestFile: path.relative(REPO_ROOT, file) };
  }));
}

function validateSchemaSubset(record, label) {
  const schema = JSON.parse(fs.readFileSync(PAGE_SCHEMA, 'utf8'));
  const errors = [];
  const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const visit = (value, rule, location) => {
    if (rule.type === 'string' && typeof value !== 'string') errors.push(`"${location}" must be a string`);
    if (rule.type === 'array' && !Array.isArray(value)) errors.push(`"${location}" must be an array`);
    if (rule.type === 'boolean' && typeof value !== 'boolean') errors.push(`"${location}" must be a boolean`);
    if (rule.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) errors.push(`"${location}" must be a finite number`);
    if (rule.type === 'integer' && !Number.isSafeInteger(value)) errors.push(`"${location}" must be an integer`);
    if (rule.type === 'object' && !isPlainObject(value)) errors.push(`"${location}" must be an object`);
    if (rule.enum && !rule.enum.includes(value)) errors.push(`"${location}" must be one of ${rule.enum.join(', ')}`);
    if (rule.pattern && typeof value === 'string' && !new RegExp(rule.pattern).test(value)) errors.push(`"${location}" has an invalid format`);
    if (rule.minLength !== undefined && typeof value === 'string' && value.length < rule.minLength) errors.push(`"${location}" must contain at least ${rule.minLength} character(s)`);
    if (rule.minItems !== undefined && Array.isArray(value) && value.length < rule.minItems) errors.push(`"${location}" must contain at least ${rule.minItems} item(s)`);
    if (rule.minimum !== undefined && typeof value === 'number' && value < rule.minimum) errors.push(`"${location}" must be at least ${rule.minimum}`);

    if (rule.type === 'object' && isPlainObject(value)) {
      for (const required of rule.required || []) {
        if (value[required] === undefined || value[required] === null || value[required] === '') errors.push(`"${location}.${required}" is required`);
      }
      for (const [key, nestedValue] of Object.entries(value)) {
        const nestedRule = rule.properties?.[key];
        if (!nestedRule) {
          if (rule.additionalProperties === false) errors.push(`unknown property "${location}.${key}"`);
          continue;
        }
        visit(nestedValue, nestedRule, `${location}.${key}`);
      }
    }
    if (rule.type === 'array' && Array.isArray(value) && rule.items) {
      value.forEach((item, index) => visit(item, rule.items, `${location}[${index}]`));
    }
  };

  for (const required of schema.required || []) {
    if (record[required] === undefined || record[required] === null || record[required] === '') errors.push(`missing required "${required}"`);
  }
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith('_')) continue;
    const rule = schema.properties?.[key];
    if (!rule) {
      if (schema.additionalProperties === false) errors.push(`unknown property "${key}"`);
      continue;
    }
    visit(value, rule, key);
  }
  if (errors.length) throw new Error(`${label}: ${errors.join('; ')}.`);
}

function validateRecord(record, { legacy = false } = {}) {
  const label = record._manifestFile || `page "${record.id || '(missing id)'}"`;
  if (!legacy) validateSchemaSubset(record, label);

  if (typeof record.id !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/i.test(record.id)) {
    throw new Error(`${label}: id must use letters, digits, dot, underscore, or hyphen.`);
  }
  if (typeof record.route !== 'string') throw new Error(`${label}: route must be a string.`);
  const output = toOutputPath(record.route);
  if (!record.title || typeof record.title !== 'string' || !record.title.trim()) throw new Error(`${label}: title is required.`);
  if (typeof record.locale !== 'string' || !/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(record.locale)) {
    throw new Error(`${label}: locale must be a BCP-47 style language tag.`);
  }
  if (record.direction && !['ltr', 'rtl'].includes(record.direction)) throw new Error(`${label}: direction must be "ltr" or "rtl".`);
  const layout = record.layout || (legacy ? 'legacy' : 'site');
  const theme = record.theme || 'default';
  if (!KNOWN_LAYOUTS.has(layout)) throw new Error(`${label}: unknown layout "${layout}". Supported layouts: ${[...KNOWN_LAYOUTS].filter((item) => item !== 'legacy').join(', ')}.`);
  if (!KNOWN_THEMES.has(theme)) throw new Error(`${label}: unknown theme "${theme}". Supported themes: ${[...KNOWN_THEMES].join(', ')}.`);

  const sourcePath = safeRepoPath(REPO_ROOT, record.source, `${label} source`);
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) throw new Error(`${label}: source does not exist: ${record.source}.`);
  const paths = [
    ...(record.styles || []),
    ...(record.script ? [record.script] : []),
    ...(record.data ? [record.data] : []),
    ...(record.collection?.data ? [record.collection.data] : []),
    ...(record.head?.preload || []).filter((item) => !/^https:\/\//i.test(item.href)).map((item) => item.href),
  ];
  for (const repoPath of paths) {
    const absolute = safeRepoPath(REPO_ROOT, repoPath, `${label} asset/data path`);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) throw new Error(`${label}: referenced path does not exist: ${repoPath}.`);
  }

  return {
    ...record,
    _manifestFile: undefined,
    direction: record.direction || 'ltr',
    theme,
    layout,
    output,
    _legacy: legacy,
  };
}

const SOURCE_ALIASES = Object.freeze([
  ['src/assets/images/', '@images/'],
  ['src/assets/fonts/', '@fonts/'],
  ['src/pages/', '@pages/'],
  ['src/views/', '@views/'],
  ['src/content/', '@content/'],
  ['src/scss/', '@scss/'],
  ['src/js/', '@js/'],
  ['project/overrides/', '@projectSourceOverrides/'],
]);

function aliasPath(repoPath, owner) {
  const normalized = repoPath.replace(/\\/g, '/');
  const alias = SOURCE_ALIASES.find(([prefix]) => normalized.startsWith(prefix));
  if (!alias) throw new Error(`${owner} must use a supported source alias: ${repoPath}.`);
  return `${alias[1]}${normalized.slice(alias[0].length)}`;
}

function pugUsesLegacyExtends(sourcePath) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  return /^extends\s+/m.test(source);
}

function createPageWrapper(page) {
  if (page._legacy) return null;
  const sourcePath = safeRepoPath(REPO_ROOT, page.source, `page ${page.id} source`);
  if (pugUsesLegacyExtends(sourcePath)) return null;

  const sourceAlias = aliasPath(page.source, `page ${page.id} source`);
  const lines = [
    '//- Generated from the validated page manifest. Do not edit.',
    `extends @layouts/${page.layout}.pug`,
    '',
    'block head',
  ];
  for (const style of page.styles || []) lines.push(`  link(href=${JSON.stringify(aliasPath(style, `page ${page.id} style`))} rel="stylesheet")`);
  for (const preload of page.head?.preload || []) {
    const href = preload.href.startsWith('https://')
      ? preload.href
      : aliasPath(preload.href, `page ${page.id} preload`);
    const attrs = [
      `rel="preload"`,
      `href=${JSON.stringify(href)}`,
      `as=${JSON.stringify(preload.as)}`,
      preload.type ? `type=${JSON.stringify(preload.type)}` : null,
      preload.crossorigin ? `crossorigin=${JSON.stringify(preload.crossorigin)}` : null,
    ].filter(Boolean).join(' ');
    lines.push(`  link(${attrs})`);
  }
  if (page.head?.canonical === 'self') {
    lines.push('  link(rel="canonical" href=(siteUrl || "") + route(pageId))');
  }
  if (page.head?.previousPageId) {
    lines.push(`  link(rel="prev" href=(siteUrl || "") + route(${JSON.stringify(page.head.previousPageId)}))`);
  }
  if (page.head?.pagination) {
    lines.push('  if pageNumber > 1 && archivePageRoutes[String(pageNumber - 1)]');
    lines.push('    link(rel="prev" href=(siteUrl || "") + route(archivePageRoutes[String(pageNumber - 1)]))');
    lines.push('  if pageNumber < totalPages && archivePageRoutes[String(pageNumber + 1)]');
    lines.push('    link(rel="next" href=(siteUrl || "") + route(archivePageRoutes[String(pageNumber + 1)]))');
  }
  if (page.head?.openGraphType) {
    lines.push(`  meta(property="og:type" content=${JSON.stringify(page.head.openGraphType)})`);
    lines.push('  meta(property="og:title" content=pageData.article ? pageData.article.title : title)');
    lines.push('  meta(property="og:description" content=pageData.article ? pageData.article.description : description)');
    lines.push('  meta(property="og:url" content=(siteUrl || "") + route(pageId))');
  }
  if (page.head?.jsonLd === 'blogPosting') {
    lines.push('  - const headArticle = pageData.article || (Array.isArray(pageData.posts) ? pageData.posts.find((post) => post.pageId === pageId) : null)');
    lines.push(`  - if (!headArticle || headArticle.draft || Date.parse(headArticle.publishedAt) > Date.parse(buildNow)) throw new Error(${JSON.stringify(`Page ${page.id} (${page.source}) has no article published for this build.`)})`);
    lines.push('  - const canonicalUrl = (siteUrl || "") + route(pageId)');
    lines.push('  - const structuredData = { "@context": "https://schema.org", "@type": "BlogPosting", headline: headArticle.title, description: headArticle.description, datePublished: headArticle.publishedAt, dateModified: headArticle.updatedAt, author: { "@type": "Person", name: headArticle.author.name }, mainEntityOfPage: canonicalUrl }');
    lines.push('  meta(property="article:published_time" content=headArticle.publishedAt)');
    lines.push('  meta(property="article:modified_time" content=headArticle.updatedAt)');
    lines.push('  meta(property="article:author" content=headArticle.author.name)');
    lines.push('  each tag in headArticle.tags');
    lines.push('    meta(property="article:tag" content=tag.label)');
    lines.push('  script(type="application/ld+json")!= JSON.stringify(structuredData).replace(/</g, "\\\\u003c")');
  }
  lines.push('  include @content/locales/hreflang.pug');
  if (page.script) lines.push(`  script(src=${JSON.stringify(aliasPath(page.script, `page ${page.id} script`))} defer="defer")`);
  lines.push('', 'block content', `  include ${sourceAlias}`, '');
  return lines.join('\n');
}

function generatePageWrappers(pages) {
  fs.mkdirSync(GENERATED_WRAPPER_DIR, { recursive: true });
  const wrappers = new Map();
  for (const page of pages) {
    const source = createPageWrapper(page);
    if (source === null) continue;
    const safeId = page.id.normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'page';
    const digest = crypto.createHash('sha256').update(page.id).digest('hex').slice(0, 8);
    const wrapperPath = path.join(GENERATED_WRAPPER_DIR, `${safeId}-${digest}.pug`);
    if (!fs.existsSync(wrapperPath) || fs.readFileSync(wrapperPath, 'utf8') !== source) {
      fs.writeFileSync(wrapperPath, source);
    }
    wrappers.set(page.id, wrapperPath);
  }
  return wrappers;
}

function registerOutput(owners, output, owner) {
  const clean = output.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!clean || clean.split('/').some((part) => part === '.' || part === '..')) throw new Error(`${owner} claims invalid output "${output}".`);
  const key = clean.normalize('NFC').toLocaleLowerCase('en-US');
  const previous = owners.get(key);
  if (previous) throw new Error(`Output collision at "${clean}": ${owner} conflicts with ${previous}.`);
  owners.set(key, owner);
}

function assertUniquePageIds(pages) {
  const owners = new Map();
  for (const page of pages) {
    const key = page.id.normalize('NFC').toLocaleLowerCase('en-US');
    const previous = owners.get(key);
    if (previous) {
      throw new Error(`Duplicate page id after normalization: "${page.id}" (${page.source}) conflicts with "${previous.id}" (${previous.source}).`);
    }
    owners.set(key, page);
  }
}

const CUSTOMER_DEMO_PROFILES = new Set(['customer-production', 'release-html', 'starter']);
const COMPLETE_DEMOS = new Set(['agency', 'saas']);

function normalizedLocale(locale) {
  try {
    return Intl.getCanonicalLocales(locale)[0].toLowerCase();
  } catch {
    return String(locale || '').toLowerCase();
  }
}

function withLocalePrefix(route, locale, defaultLocale) {
  if (!locale || normalizedLocale(locale) === normalizedLocale(defaultLocale)) return route;
  const prefix = `/${locale}`;
  if (route === `${prefix}/` || route.startsWith(`${prefix}/`)) return route;
  return route === '/' ? `${prefix}/` : `${prefix}${route}`;
}

function mountedRoute(route, demoId, profile, locale, site) {
  if (!demoId) return route;
  const defaultLocale = site?.defaultLocales?.[demoId]
    || (site?.demoId === demoId ? site.defaultLocale : null)
    || 'en';
  const localizedRoute = withLocalePrefix(route, locale, defaultLocale);
  if (!['development', 'catalog-preview'].includes(profile)) return localizedRoute;
  const prefix = `/demos/${demoId}`;
  if (localizedRoute === '/') return `${prefix}/`;
  return `${prefix}${localizedRoute}`;
}

function materializeProfilePages(pages, { profile, demoId, site }) {
  let selected = pages;
  if (CUSTOMER_DEMO_PROFILES.has(profile)) {
    if (!COMPLETE_DEMOS.has(demoId)) {
      throw new Error(`Demo "${demoId}" is not a complete customer package. Choose ${[...COMPLETE_DEMOS].join(' or ')}.`);
    }
    selected = pages.filter((page) => (
      page.id === 'system.404'
      || page.demoId === demoId
      || (page.requiredByDemos || []).includes(demoId)
    ));
    const homes = selected.filter((page) => page.demoId === demoId && page.demoHome);
    if (homes.length !== 1) throw new Error(`Demo "${demoId}" needs exactly one demoHome page; found ${homes.length}.`);
    if (homes[0].route !== '/') throw new Error(`Demo "${demoId}" demoHome must declare route "/" before profile mounting.`);
    if (profile === 'starter') selected = selected.filter((page) => page.id === 'system.404' || page.starter || (page.requiredByDemos || []).includes(demoId));
  }

  for (const home of selected.filter((page) => page.demoId && page.demoHome)) {
    const defaultLocale = site?.defaultLocales?.[home.demoId]
      || (site?.demoId === home.demoId ? site.defaultLocale : null)
      || home.locale;
    if (normalizedLocale(home.locale) !== normalizedLocale(defaultLocale)) {
      throw new Error(`Demo "${home.demoId}" defaultLocale "${defaultLocale}" must match its demoHome locale "${home.locale}".`);
    }
  }

  const demoHomeById = new Map(selected.filter((page) => page.demoId && page.demoHome).map((page) => [page.demoId, page.id]));
  const brandByDemo = { agency: 'Fieldwork', saas: 'Orbit' };
  const mounted = selected.map((page) => {
    const route = mountedRoute(page.route, page.demoId, profile, page.locale, site);
    const starterMode = profile === 'starter';
    const noindex = starterMode || profile === 'development';
    const pageData = page._pugData && typeof page._pugData === 'object' ? page._pugData : {};
    const homePageId = page.demoId
      ? demoHomeById.get(page.demoId)
      : page.id === 'system.404'
        ? (demoHomeById.get(demoId) || 'legacy.home')
        : 'legacy.home';
    return {
      ...page,
      route,
      title: page.demoId === 'saas' ? page.title.replace(/Interface Kit/g, 'Orbit') : page.title,
      output: page.id === 'system.404' ? '404.html' : toOutputPath(route),
      robots: noindex ? 'noindex,nofollow' : page.robots,
      _pugData: {
        ...pageData,
        starterMode,
        selectedDemoId: demoId,
        homePageId,
        demoBrand: brandByDemo[page.demoId] || 'Interface Kit',
      },
    };
  });

  if (CUSTOMER_DEMO_PROFILES.has(profile)) {
    const homes = mounted.filter((page) => page.demoId === demoId && page.demoHome);
    if (homes.length !== 1 || homes[0].route !== '/') throw new Error(`Profile "${profile}" must emit exactly one selected-demo home at "/".`);
  }
  attachHreflangAlternates(mounted, site, profile);
  return mounted;
}

function attachHreflangAlternates(pages, site, profile = 'selected') {
  const byTranslationKey = new Map();
  for (const page of pages) {
    if (!page.translationKey) continue;
    const group = byTranslationKey.get(page.translationKey) || [];
    group.push(page);
    byTranslationKey.set(page.translationKey, group);
  }

  for (const [translationKey, group] of byTranslationKey) {
    const locales = new Map();
    for (const page of group) {
      const key = page.locale.toLowerCase();
      if (locales.has(key)) throw new Error(`Translation group "${translationKey}" has multiple pages for locale "${page.locale}".`);
      locales.set(key, page);
    }
    const expected = new Set(group.flatMap((page) => page.translationLocales || []));
    for (const locale of expected) {
      if (!locales.has(locale.toLowerCase())) throw new Error(`Translation target missing for "${translationKey}": locale "${locale}" is declared but no page instance is included in profile "${profile}".`);
    }
    if (locales.size < 2) continue;
    if (!site?.siteUrl) throw new Error(`SITE_URL is required to emit hreflang for translated page group "${translationKey}".`);
    for (const page of group) {
      page._pugData = {
        ...(page._pugData || {}),
        hreflangAlternates: [...locales.values()]
          .filter((target) => target.id !== page.id)
          .map((target) => ({
            locale: target.locale,
            href: `${site.siteUrl}${site.basePath === '/' ? '' : site.basePath.replace(/\/$/, '')}${target.route === '/' ? '/' : target.route}`,
          })),
      };
    }
  }
}

function collectPublicOutputs(publicRoot) {
  if (!fs.existsSync(publicRoot)) return [];
  const files = [];
  const visit = (directory) => {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, item.name);
      if (item.isDirectory()) visit(absolute);
      else if (item.isFile()) files.push({ source: absolute, output: path.relative(publicRoot, absolute).split(path.sep).join('/') });
    }
  };
  visit(publicRoot);
  return files.sort((a, b) => a.output.localeCompare(b.output));
}

function writeManifestIfChanged(payload) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  const contents = `${JSON.stringify(payload, null, 2)}\n`;
  if (fs.existsSync(GENERATED_MANIFEST) && fs.readFileSync(GENERATED_MANIFEST, 'utf8') === contents) return;
  const temporary = `${GENERATED_MANIFEST}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, contents);
  fs.renameSync(temporary, GENERATED_MANIFEST);
}

function loadPages({ buildNow = null, site = null, profile = null } = {}) {
  const pagesRoots = [path.join(REPO_ROOT, 'src/pages'), path.join(REPO_ROOT, 'src/views')];
  const legacyRecords = legacyPages.map((record) => validateRecord(record, { legacy: true }));
  const frameworkPages = readPageJson(pagesRoots).map((record) => validateRecord(record));
  const overrideRecords = site?.projectOverrides?.pageRecords || [];
  const occupiedIds = new Set([...legacyRecords, ...frameworkPages].map((page) => page.id.normalize('NFC').toLocaleLowerCase('en-US')));
  const occupiedDemoRoutes = new Set([...legacyRecords, ...frameworkPages].filter((page) => page.demoId).map((page) => `${page.demoId}\0${page.route}`));
  const overridePages = [];
  for (const record of overrideRecords) {
    const label = record._manifestFile || `project page "${record.id || '(missing id)'}"`;
    try {
      const page = validateRecord(record);
      const idKey = page.id.normalize('NFC').toLocaleLowerCase('en-US');
      const demoRouteKey = `${page.demoId}\0${page.route}`;
      if (occupiedIds.has(idKey)) throw new Error(`page id "${page.id}" already exists.`);
      if (occupiedDemoRoutes.has(demoRouteKey)) throw new Error(`route "${page.route}" is already owned by demo "${page.demoId}".`);
      occupiedIds.add(idKey);
      occupiedDemoRoutes.add(demoRouteKey);
      overridePages.push(page);
    } catch (error) {
      process.stderr.write(`Project override ${label} ignored: ${error.message}\n`);
    }
  }
  const collections = frameworkPages.filter((page) => page.collection);
  if (collections.length > 1) throw new Error(`Only one blog collection is currently supported; found ${collections.length} collection descriptors.`);
  const generatedPages = collections.flatMap((page) => generateBlogCollection({
    collection: page.collection,
    templates: new Map(frameworkPages.map((template) => [template.id, template])),
    buildNow: buildNow || new Date().toISOString(),
  }).map((generated) => (
    generated.id !== page.collection.archiveTemplateId && generated.translationKey === page.collection.archiveTemplateId
      ? { ...generated, translationKey: generated.id }
      : generated
  )));
  const generatedPrefixes = collections.flatMap((page) => page.collection.ownedIdPrefixes || []);
  const generatedRecords = generatedPages.map((record) => validateRecord(record));
  const generatedIds = new Set(generatedRecords.map((page) => page.id.normalize('NFC').toLocaleLowerCase('en-US')));
  const generatedDemoRoutes = new Set(generatedRecords.filter((page) => page.demoId).map((page) => `${page.demoId}\0${page.route}`));
  const acceptedOverridePages = overridePages.filter((page) => {
    const idKey = page.id.normalize('NFC').toLocaleLowerCase('en-US');
    const demoRouteKey = `${page.demoId}\0${page.route}`;
    if (generatedIds.has(idKey) || generatedDemoRoutes.has(demoRouteKey)) {
      process.stderr.write(`Project override ${page._manifestFile} ignored: its page id or demo route conflicts with generated content.\n`);
      return false;
    }
    return true;
  });
  const sourcePages = frameworkPages.filter((page) => (
    !page.collection && !generatedPrefixes.some((prefix) => page.id.startsWith(prefix))
  ));
  const pages = [
    ...legacyRecords,
    ...sourcePages,
    ...acceptedOverridePages,
    ...generatedRecords,
    { ...validateRecord({ id: 'system.404', route: '/404/', source: 'build/pages/404.pug', title: 'Page not found', locale: 'en', direction: 'ltr', layout: 'minimal', _legacy: true }, { legacy: true }), output: '404.html' },
  ];

  assertUniquePageIds(pages);

  const selectedDemoId = site?.demoId || 'saas';
  const profilePages = materializeProfilePages(pages, { profile, demoId: selectedDemoId, site });

  const owners = new Map();
  for (const page of profilePages) {
    registerOutput(owners, page.output, `page ${page.id} (${page.source})`);
  }

  const publicRoot = path.join(REPO_ROOT, 'public');
  const publicFiles = collectPublicOutputs(publicRoot);
  for (const file of publicFiles) registerOutput(owners, file.output, `public/${file.output}`);
  registerOutput(owners, 'robots.txt', 'generator:robots');
  if (site?.siteUrl && profile !== 'catalog-preview') registerOutput(owners, 'sitemap.xml', 'generator:sitemap');

  // This is the authoritative set for generation and stale-output cleanup.
  const publicPages = profilePages.map(({ _legacy, _pugData, ...record }) => record);
  const manifestPayload = {
    version: 1,
    buildNow,
    profile,
    selectedDemo: selectedDemoId,
    site: site ? {
      siteUrl: site.siteUrl,
      basePath: site.basePath,
      assetBase: site.assetBase,
      demoId: site.demoId,
      defaultLocale: site.defaultLocale || site.defaultLocales?.[site.demoId] || 'en',
      defaultLocales: site.defaultLocales || {},
    } : null,
    pages: publicPages,
    outputs: [...owners.entries()].map(([key, owner]) => ({ key, owner })),
  };

  return { pages: profilePages, publicFiles, outputs: owners, manifestPayload };
}

module.exports = {
  PAGE_SCHEMA,
  GENERATED_MANIFEST,
  GENERATED_WRAPPER_DIR,
  KNOWN_LAYOUTS,
  KNOWN_THEMES,
  REPO_ROOT,
  toOutputPath,
  validateRecord,
  validateSchemaSubset,
  aliasPath,
  createPageWrapper,
  generatePageWrappers,
  assertUniquePageIds,
  mountedRoute,
  materializeProfilePages,
  attachHreflangAlternates,
  registerOutput,
  collectPublicOutputs,
  writeManifestIfChanged,
  loadPages,
};
