const fs = require('node:fs');
const path = require('node:path');
const { loadPages } = require('../../build/pages/manifest.cjs');
const { createSitemap } = require('../../build/webpack/plugins.cjs');

const repoRoot = path.resolve(__dirname, '../..');
const distRoot = path.join(repoRoot, 'dist');
const manifestPath = path.join(repoRoot, '.generated/pages-manifest.json');
const failures = [];

function fail(message) {
  failures.push(message);
}

function decodeEntities(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, (entity) => {
    const lower = entity.toLowerCase();
    if (lower === '&amp;') return '&';
    if (lower === '&quot;') return '"';
    if (lower === '&apos;') return "'";
    if (lower === '&lt;') return '<';
    if (lower === '&gt;') return '>';
    const hex = lower.startsWith('&#x');
    const numeric = Number.parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
    return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : entity;
  });
}

function parseAttributes(tag) {
  const attributes = {};
  const opening = tag.match(/^<\s*[A-Za-z][\w:-]*/)?.[0] || '';
  const body = tag.slice(opening.length, -1);
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = pattern.exec(body))) attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  return attributes;
}

function tags(content, tagName) {
  const matches = content.match(new RegExp(`<\\s*${tagName}\\b[^>]*>`, 'gi')) || [];
  return matches.map((tag) => parseAttributes(tag));
}

function walkHtml(directory, found = []) {
  if (!fs.existsSync(directory)) return found;
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, item.name);
    if (item.isDirectory()) walkHtml(absolute, found);
    else if (item.isFile() && item.name.endsWith('.html')) found.push(absolute);
  }
  return found;
}

function expectedCanonical(page, siteUrl, basePath) {
  const prefix = basePath === '/' ? '' : basePath.replace(/\/$/, '');
  return `${siteUrl}${prefix}${page.route === '/' ? '/' : page.route}`;
}

function routeFromLocalUrl(value, currentRoute, siteUrl, basePath) {
  if (!value || value.startsWith('#') || /^(?:mailto:|tel:|javascript:|data:|blob:)/i.test(value)) return null;
  let parsed;
  try {
    const basePrefix = basePath === '/' ? '' : basePath.replace(/\/$/, '');
    parsed = new URL(value, `${siteUrl || 'https://phase5.invalid'}${basePrefix}${currentRoute}`);
  } catch {
    return { error: `invalid internal URL "${value}"` };
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return null;
  if (siteUrl && parsed.origin !== new URL(siteUrl).origin) return null;
  if (!siteUrl && parsed.origin !== 'https://phase5.invalid') return null;
  let pathname;
  try { pathname = decodeURIComponent(parsed.pathname); } catch { return { error: `invalid encoded path in URL "${value}"` }; }
  if (!pathname.startsWith(basePath)) return { error: `path "${pathname}" is outside basePath "${basePath}"` };
  const route = basePath === '/' ? pathname : `/${pathname.slice(basePath.length)}`;
  const normalized = route === '' ? '/' : route;
  return { route: normalized.endsWith('/') || path.posix.extname(normalized) ? normalized : `${normalized}/` };
}

function checkMaintenanceProfileContracts() {
  for (const demoId of ['agency', 'saas']) {
    for (const profile of ['customer-production', 'starter']) {
      const loaded = loadPages({
        buildNow: '2026-10-01T00:00:00.000Z',
        site: {
          siteUrl: 'https://phase5.invalid',
          basePath: '/preview/theme/',
          assetBase: '/preview/theme/',
          demoId,
          defaultLocales: { agency: 'en', saas: 'en' },
          defaultLocale: 'en',
        },
        profile,
      });
      const page = loaded.pages.find((item) => item.id === 'system.maintenance');
      const expectedRobots = profile === 'starter' ? 'noindex,nofollow' : 'noindex,follow';
      if (!page) fail(`${profile}/${demoId} package is missing system.maintenance.`);
      else {
        if (page.route !== '/maintenance/') fail(`${profile}/${demoId} maintenance route is ${page.route}; expected /maintenance/.`);
        if (page.layout !== 'minimal') fail(`${profile}/${demoId} maintenance layout is ${page.layout}; expected minimal.`);
        if (page.robots !== expectedRobots) fail(`${profile}/${demoId} maintenance robots are ${page.robots || '(missing)'}; expected ${expectedRobots}.`);
        if (page.navigation) fail(`${profile}/${demoId} maintenance page must not register navigation metadata.`);
        if (page._pugData?.selectedDemoId !== demoId) fail(`${profile}/${demoId} maintenance page does not receive the selected demo context.`);
      }
      const sitemap = createSitemap(loaded.manifestPayload);
      if (sitemap?.includes('https://phase5.invalid/preview/theme/maintenance/')) {
        fail(`${profile}/${demoId} sitemap includes the noindex maintenance route.`);
      }
    }
  }
}

function main() {
  checkMaintenanceProfileContracts();
  if (!fs.existsSync(manifestPath) || !fs.existsSync(distRoot)) {
    process.stderr.write('Phase 5 profile check needs a completed Webpack build (dist/ and .generated/pages-manifest.json).\n');
    process.exitCode = 1;
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const profile = process.env.EXPECTED_PROFILE || manifest.profile;
  const demoId = process.env.EXPECTED_DEMO || manifest.selectedDemo;
  const basePath = manifest.site?.basePath || '/';
  const siteUrl = manifest.site?.siteUrl || null;
  const customerProfile = ['customer-production', 'release-html', 'starter'].includes(profile);
  const pages = manifest.pages || [];
  const pagesByOutput = new Map(pages.map((page) => [page.output, page]));
  const pagesByRoute = new Map(pages.map((page) => [page.route, page]));
  const selectedHome = pages.filter((page) => page.demoId === demoId && page.demoHome);
  const maintenancePage = pages.find((page) => page.id === 'system.maintenance');

  if (manifest.profile !== profile) fail(`expected profile ${profile}; manifest reports ${manifest.profile}.`);
  if (manifest.selectedDemo !== demoId) fail(`expected demo ${demoId}; manifest reports ${manifest.selectedDemo}.`);
  if (process.env.EXPECTED_BASE_PATH && process.env.EXPECTED_BASE_PATH !== basePath) fail(`expected basePath ${process.env.EXPECTED_BASE_PATH}; manifest reports ${basePath}.`);
  if (customerProfile && !maintenancePage) fail(`${profile}/${demoId} build must emit system.maintenance.`);
  if (customerProfile) {
    if (selectedHome.length !== 1 || selectedHome[0].route !== '/') fail(`customer profile must contain exactly one ${demoId} homepage at /; found ${selectedHome.length}.`);
    for (const page of pages) {
      if (page.id !== 'system.404' && page.demoId !== demoId && !(page.requiredByDemos || []).includes(demoId)) {
        fail(`customer profile contains foreign page ${page.id} (demoId=${page.demoId || 'none'}).`);
      }
    }
  }

  if (profile === 'catalog-preview') {
    for (const packageId of ['agency', 'saas']) {
      const home = pages.find((page) => page.demoId === packageId && page.demoHome);
      if (!home || home.route !== `/demos/${packageId}/`) fail(`catalog preview is missing mounted ${packageId} home at /demos/${packageId}/.`);
    }
    if (!pages.some((page) => page.id === 'legacy.home' && page.route === '/')) fail('catalog preview must retain the framework catalog home at /.');
  }

  if (profile === 'starter') {
    for (const page of pages) {
      const directives = (page.robots || '').toLowerCase().split(',').map((value) => value.trim());
      if (!directives.includes('noindex') || !directives.includes('nofollow')) fail(`starter page ${page.id} must use noindex,nofollow.`);
    }
  }

  for (const [output, page] of pagesByOutput) {
    const absolute = path.join(distRoot, output);
    if (!fs.existsSync(absolute)) {
      fail(`manifest page ${page.id} is missing dist/${output}.`);
      continue;
    }
    const html = fs.readFileSync(absolute, 'utf8');
    const canonical = tags(html, 'link').find((item) => (item.rel || '').toLowerCase().split(/\s+/).includes('canonical'));
    if (page.demoId && siteUrl) {
      if (!canonical) fail(`${page.id} has SITE_URL configured but emits no canonical link.`);
      else if (canonical.href !== expectedCanonical(page, siteUrl, basePath)) fail(`${page.id} canonical is ${canonical.href}; expected ${expectedCanonical(page, siteUrl, basePath)}.`);
    }

    const robotsTag = tags(html, 'meta').find((item) => (item.name || '').toLowerCase() === 'robots');
    const robots = (robotsTag?.content || '').toLowerCase().replace(/\s/g, '');
    if (profile === 'catalog-preview' && robots !== 'noindex,follow') fail(`${page.id} should emit robots noindex,follow in catalog preview; found "${robots || '(missing)'}".`);
    if (profile === 'starter' && robots !== 'noindex,nofollow') fail(`${page.id} should emit robots noindex,nofollow in starter; found "${robots || '(missing)'}".`);
    if (profile === 'development' && robots !== 'noindex,nofollow') fail(`${page.id} should emit robots noindex,nofollow in development; found "${robots || '(missing)'}".`);
    if (customerProfile && profile !== 'starter' && page.robots && robots !== page.robots.toLowerCase().replace(/\s/g, '')) fail(`${page.id} robots metadata is "${robots || '(missing)'}"; manifest declares "${page.robots}".`);

    if (page.id === 'system.maintenance') {
      const body = tags(html, 'body')[0];
      const expectedRobots = profile === 'starter' || profile === 'development' ? 'noindex,nofollow' : 'noindex,follow';
      if (body?.['data-layout'] !== 'minimal') fail(`system.maintenance body layout is "${body?.['data-layout'] || '(missing)'}"; expected minimal.`);
      if (robots !== expectedRobots) fail(`system.maintenance emitted robots metadata is "${robots || '(missing)'}"; expected ${expectedRobots}.`);
      if (pages.some((item) => item.id === 'system.maintenance' && item.navigation)) fail('system.maintenance must remain out of navigation metadata.');
      const homepageRoute = selectedHome[0]?.route;
      const linkedHomepage = tags(html, 'a').some((anchor) => {
        const target = routeFromLocalUrl(anchor.href, page.route, siteUrl, basePath);
        return target && !target.error && target.route === homepageRoute;
      });
      if (!homepageRoute || !linkedHomepage) fail(`system.maintenance must link internally to the selected ${demoId} homepage.`);
      const sitemapPath = path.join(distRoot, 'sitemap.xml');
      if (fs.existsSync(sitemapPath)) {
        const prefix = basePath === '/' ? '' : basePath.replace(/\/$/, '');
        const maintenanceUrl = siteUrl ? `${siteUrl}${prefix}${page.route}` : null;
        if (maintenanceUrl && fs.readFileSync(sitemapPath, 'utf8').includes(maintenanceUrl)) fail(`sitemap.xml includes noindex route ${maintenanceUrl}.`);
      }
    }

    const sourceRoute = page.route;
    for (const anchor of [...tags(html, 'a'), ...tags(html, 'area')]) {
      if (!anchor.href) continue;
      const target = routeFromLocalUrl(anchor.href, sourceRoute, siteUrl, basePath);
      if (!target || target.error) {
        if (target?.error) fail(`${page.id}: ${target.error}.`);
        continue;
      }
      if (customerProfile && !pagesByRoute.has(target.route)) fail(`${page.id} links outside the selected package to ${anchor.href} (resolved route ${target.route}).`);
    }
  }

  if (profile === 'catalog-preview' && fs.existsSync(path.join(distRoot, 'sitemap.xml'))) fail('catalog preview must not emit sitemap.xml.');

  const htmlCount = walkHtml(distRoot).length;
  if (htmlCount !== pages.length) fail(`manifest contains ${pages.length} pages but dist has ${htmlCount} HTML files.`);

  if (failures.length) {
    process.stderr.write(`Phase 5 profile check failed (${profile}, ${demoId}, basePath ${basePath}) with ${failures.length} issue(s):\n`);
    failures.forEach((message) => process.stderr.write(`- ${message}\n`));
    process.exitCode = 1;
    return;
  }

  const packageCount = pages.filter((page) => page.demoId === demoId).length;
  process.stdout.write(`Phase 5 profile check passed: ${profile}, demo ${demoId}, basePath ${basePath}; ${pages.length} HTML routes (${packageCount} package pages), selected home ${selectedHome[0]?.route || 'catalog'}; maintenance profile/build contract, internal package links and metadata verified.\n`);
}

if (require.main === module) main();
