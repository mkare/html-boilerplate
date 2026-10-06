#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const parse5 = require('parse5');
const sass = require('sass');
const { loadProjectOverrides, validateBrand } = require('../../build/overrides/project-overrides.cjs');
const { createNavigation } = require('../../webpack.config.js');

const repoRoot = path.resolve(__dirname, '../..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-overrides-'));
const warnings = [];
let cleanupFailed = false;

function removeEmptyDirectory(directory) {
  try {
    fs.rmdirSync(directory);
  } catch (error) {
    if (['ENOENT', 'ENOTEMPTY'].includes(error.code)) return;
    cleanupFailed = true;
    process.stderr.write(`Could not remove empty fixture directory ${directory}: ${error.message}\n`);
  }
}

const write = (relative, content) => {
  const filename = path.join(root, relative);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, content);
  return filename;
};
const json = (relative, value) => write(relative, `${JSON.stringify(value, null, 2)}\n`);
const override = (relative) => `project/overrides/${relative}`;

function copyTree(source, destination) {
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) throw new Error(`Integration fixture cannot copy a symlink: ${source}`);
  if (stat.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true });
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      copyTree(path.join(source, entry.name), path.join(destination, entry.name));
    }
  } else if (stat.isFile()) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  } else throw new Error(`Integration fixture cannot copy special file: ${source}`);
}

function assertFixtureTargetAvailable(filename, { allowEmptyDirectory = false } = {}) {
  try {
    const stat = fs.lstatSync(filename);
    assert.ok(!stat.isSymbolicLink(), `${filename} must not be a symbolic link`);
    if (allowEmptyDirectory && stat.isDirectory()) {
      assert.deepEqual(fs.readdirSync(filename), [], `${filename} must be empty before this QA fixture runs`);
      return true;
    }
    assert.fail(`${filename} already exists; the QA will not overwrite it.`);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function nodeList(document) {
  const found = [];
  const visit = (node) => {
    if (node.tagName) found.push({
      tag: node.tagName,
      attrs: Object.fromEntries((node.attrs || []).map((attribute) => [attribute.name, attribute.value])),
      text: (node.childNodes || []).map((child) => child.value || '').join(''),
    });
    for (const child of node.childNodes || []) visit(child);
    if (node.content) visit(node.content);
  };
  visit(document);
  return found;
}

function fileForAsset(distRoot, value) {
  const pathname = new URL(value, 'https://override-qa.example').pathname;
  return path.join(distRoot, ...pathname.replace(/^\/+/, '').split('/'));
}

function runProductionBuild(buildRoot) {
  const cli = path.join(buildRoot, 'node_modules/webpack-cli/bin/cli.js');
  const environment = {
    ...process.env,
    BASE_PATH: '/',
    ASSET_BASE: '/',
    SITE_URL: 'https://override-qa.example',
    BUILD_DEMO: 'saas',
    BUILD_NOW: '2026-10-04T00:00:00.000Z',
  };
  const build = spawnSync(process.execPath, [cli, 'build', '--mode', 'production', '--config', path.join(buildRoot, 'webpack.config.js'), '--env', 'profile=customer-production', '--env', 'demo=saas'], {
    cwd: buildRoot,
    env: environment,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (build.error) throw build.error;
  if (build.status !== 0) {
    const lines = `${build.stdout || ''}\n${build.stderr || ''}`.trim().split(/\r?\n/).slice(-80).join('\n');
    throw new Error(`Isolated production build failed (exit ${build.status}).\n${lines}`);
  }
  return { dist: path.join(buildRoot, 'dist'), output: `${build.stdout || ''}${build.stderr || ''}`, environment };
}

function checkDist(buildRoot, environment) {
  const check = spawnSync(process.execPath, [path.join(buildRoot, 'qa/check-dist.cjs')], {
    cwd: buildRoot,
    env: environment,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
  if (check.error) throw check.error;
  if (check.status !== 0) throw new Error(`Isolated check:dist failed.\n${check.stdout || ''}\n${check.stderr || ''}`);
  return `${check.stdout || ''}${check.stderr || ''}`;
}

function copyBuildRoot(destination) {
  for (const relative of ['src', 'build', 'config', 'public', 'project/overrides', 'webpack.config.js', 'package.json', '.browserslistrc', 'qa/check-dist.cjs']) {
    const source = path.join(repoRoot, relative);
    if (!fs.existsSync(source) && relative === 'public') continue;
    copyTree(source, path.join(destination, relative));
  }
  fs.symlinkSync(fs.realpathSync(path.join(repoRoot, 'node_modules')), path.join(destination, 'node_modules'), 'dir');
}

function installIntegrationFixture(overlayRoot, publicFixtureRoot) {
  const writeAt = (base, relative, content) => {
    const filename = path.join(base, relative);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, content);
    return filename;
  };
  writeAt(publicFixtureRoot, 'brand.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1H0z"/></svg>');
  const publicFontsRoot = path.join(publicFixtureRoot, 'fonts');
  fs.mkdirSync(publicFontsRoot, { recursive: true });
  fs.copyFileSync(path.join(repoRoot, 'src/assets/fonts/Inter-Latin.woff2'), path.join(publicFontsRoot, 'Inter-Latin.woff2'));
  fs.copyFileSync(path.join(repoRoot, 'src/assets/fonts/OFL-Inter.txt'), path.join(publicFontsRoot, 'OFL-Inter.txt'));
  writeAt(overlayRoot, 'brand.json', JSON.stringify({ name: 'Northstar Studio', logo: 'project-override-qa/brand.svg' }, null, 2));
  writeAt(overlayRoot, 'theme.json', JSON.stringify({
    themes: { default: { light: { '--color-accent': '#145f59' }, dark: { '--color-accent': '#75d6c9' } } },
  }, null, 2));
  writeAt(overlayRoot, 'navigation.json', JSON.stringify({
    items: [
      { pageId: 'saas.features', label: 'Capabilities', groups: ['main', 'footer'], order: 2 },
      { pageId: 'customer.about', label: 'Our studio', groups: ['main', 'footer'], order: 5 },
    ],
  }, null, 2));
  writeAt(overlayRoot, 'custom.scss', [
    '@font-face {',
    '  font-family: "Northstar Inter";',
    '  font-style: normal;',
    '  font-weight: 100 900;',
    '  font-display: swap;',
    '  src: url("../../public/project-override-qa/fonts/Inter-Latin.woff2") format("woff2");',
    '}',
    '',
    'html[data-theme] {',
    '  --font-family-sans: "Northstar Inter", system-ui, sans-serif;',
    '}',
    '',
    '.override-build-proof { outline-color: #145f59; }',
    '',
  ].join('\n'));
  writeAt(overlayRoot, 'assets/wrapper-shared.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1H0z"/></svg>');
  writeAt(overlayRoot, 'pages/about/page.pug', 'section(aria-labelledby="custom-title")\n  h1#custom-title About our studio\n  a(href=route("saas.home")) Return home\n  img(src=require("@projectSourceOverrides/assets/wrapper-shared.svg"), alt="Shared wrapper fixture", width="1", height="1")\n');
  writeAt(overlayRoot, 'pages/about/page.scss', '.customer-about { padding: 1rem; }\n');
  writeAt(overlayRoot, 'pages/about/page.js', 'document.documentElement.dataset.customerAbout = "true";\n');
  writeAt(overlayRoot, 'pages/about/page.json', JSON.stringify({
    id: 'customer.about',
    route: '/about-our-studio/',
    source: 'project/overrides/pages/about/page.pug',
    title: 'About our studio',
    locale: 'tr',
    layout: 'site',
    theme: 'default',
    styles: ['project/overrides/pages/about/page.scss'],
    script: 'project/overrides/pages/about/page.js',
    navigation: { groups: ['main', 'footer'], label: 'Studio', order: 5 },
  }, null, 2));
  writeAt(overlayRoot, 'pages/team/leadership/page.pug', 'section(aria-labelledby="team-title")\n  h1#team-title Our team\n  img(src=require("@projectSourceOverrides/assets/wrapper-shared.svg"), alt="Shared wrapper fixture", width="1", height="1")\n');
  writeAt(overlayRoot, 'pages/team/leadership/page.json', JSON.stringify({
    id: 'customer.team',
    route: '/our-team/',
    source: 'project/overrides/pages/team/leadership/page.pug',
    title: 'Our team',
    locale: 'en',
    layout: 'site',
    theme: 'default',
  }, null, 2));
}

function inspectValidIntegration(distRoot) {
  const html = fs.readFileSync(path.join(distRoot, 'index.html'), 'utf8');
  const nodes = nodeList(parse5.parse(html));
  const links = nodes.filter((node) => node.tag === 'link');
  const stylesheets = links.filter((node) => node.attrs.rel === 'stylesheet').map((node) => node.attrs.href);
  const text = nodes.map((node) => node.text).join(' ');
  assert.match(text, /Northstar Studio/);
  assert.match(html, /project-override-qa\/brand\.svg/);
  assert.ok(fs.existsSync(path.join(distRoot, 'project-override-qa/brand.svg')));
  assert.deepEqual(
    fs.readFileSync(path.join(distRoot, 'project-override-qa/fonts/Inter-Latin.woff2')),
    fs.readFileSync(path.join(repoRoot, 'src/assets/fonts/Inter-Latin.woff2')),
    'public customer font source is copied unchanged',
  );
  assert.deepEqual(
    fs.readFileSync(path.join(distRoot, 'project-override-qa/fonts/OFL-Inter.txt')),
    fs.readFileSync(path.join(repoRoot, 'src/assets/fonts/OFL-Inter.txt')),
    'customer font license is copied unchanged beside the source file',
  );
  assert.match(html, /Capabilities/);
  assert.match(html, /Our studio/);
  assert.match(html, /href="\/tr\/about-our-studio\/"/);
  const tokenIndex = stylesheets.findIndex((href) => /project-tokens\.[a-f0-9]{8}\.css/.test(href));
  const customIndex = stylesheets.findIndex((href) => /project-custom\.[a-f0-9]{8}\.css/.test(href));
  const layoutIndex = stylesheets.findIndex((href) => /layout\.[a-f0-9]{8}\.css/.test(href));
  assert.ok(layoutIndex >= 0 && tokenIndex > layoutIndex && customIndex > tokenIndex, `expected core → theme → layout → page → project styles, got ${stylesheets.join(', ')}`);
  const tokenCss = fs.readFileSync(fileForAsset(distRoot, stylesheets[tokenIndex]), 'utf8');
  const customCss = fs.readFileSync(fileForAsset(distRoot, stylesheets[customIndex]), 'utf8');
  assert.match(tokenCss, /--color-accent:\s*#145f59/);
  assert.match(customCss, /override-build-proof/);
  assert.match(customCss, /font-family:\s*["']?Northstar Inter["']?/);
  assert.match(customCss, /font-weight:\s*100 900/);
  assert.match(customCss, /font-display:\s*swap/);
  assert.match(customCss, /--font-family-sans:\s*"Northstar Inter",\s*system-ui,\s*sans-serif/);
  const customFontUrl = customCss.match(/url\(["']?([^"')]*Inter-Latin\.[a-f0-9]{8}\.woff2)["']?\)/)?.[1];
  assert.ok(customFontUrl, 'custom Sass must reference a content-hashed Inter font asset');
  assert.match(customFontUrl, /(?:^|\/)assets\/fonts\/Inter-Latin\.[a-f0-9]{8}\.woff2$/);
  const emittedCustomFont = fileForAsset(distRoot, customFontUrl);
  assert.ok(fs.existsSync(emittedCustomFont), `custom font asset must exist in dist: ${customFontUrl}`);
  assert.deepEqual(
    fs.readFileSync(emittedCustomFont),
    fs.readFileSync(path.join(repoRoot, 'src/assets/fonts/Inter-Latin.woff2')),
    'hashed customer font asset keeps the licensed source font bytes',
  );
  assert.ok(fs.existsSync(path.join(distRoot, 'tr/about-our-studio/index.html')));
  const pageHtml = fs.readFileSync(path.join(distRoot, 'tr/about-our-studio/index.html'), 'utf8');
  const pageNodes = nodeList(parse5.parse(pageHtml));
  const pageStylesheets = pageNodes.filter((node) => node.tag === 'link' && node.attrs.rel === 'stylesheet').map((node) => node.attrs.href);
  const pageLayoutIndex = pageStylesheets.findIndex((href) => /layout\.[a-f0-9]{8}\.css/.test(href));
  const pageTokenIndex = pageStylesheets.findIndex((href) => /project-tokens\.[a-f0-9]{8}\.css/.test(href));
  const pageCustomIndex = pageStylesheets.findIndex((href) => /project-custom\.[a-f0-9]{8}\.css/.test(href));
  const pageStyleIndexes = pageStylesheets.flatMap((href, index) => /customer-about\.[a-f0-9]{8}\.css/.test(href) ? [index] : []);
  assert.equal(pageStyleIndexes.length, 1, `expected one manifest-owned customer page stylesheet, got ${pageStylesheets.join(', ')}`);
  assert.ok(pageLayoutIndex >= 0 && pageStyleIndexes[0] > pageLayoutIndex && pageStyleIndexes[0] < pageTokenIndex && pageTokenIndex < pageCustomIndex, 'customer page styles must follow layout CSS and precede project overrides');
  const pageScripts = pageNodes.filter((node) => node.tag === 'script' && /customer-about\.[a-f0-9]{8}\.js/.test(node.attrs.src || ''));
  assert.equal(pageScripts.length, 1, 'customer override page script must be emitted and declared once by its wrapper');
  const fontPreloads = pageNodes.filter((node) => node.tag === 'link' && node.attrs.rel === 'preload' && node.attrs.as === 'font');
  assert.ok(fontPreloads.some((node) => /Inter-Latin\.[a-f0-9]{8}\.woff2$/.test(node.attrs.href)));
  assert.ok(fontPreloads.some((node) => /Inter-Latin-Ext\.[a-f0-9]{8}\.woff2$/.test(node.attrs.href)), 'Turkish page must preload the Latin-ext subset');
  assert.ok(fontPreloads.every((node) => node.attrs.crossorigin === 'anonymous'));
  const englishPreloads = links.filter((node) => node.attrs.rel === 'preload' && node.attrs.as === 'font');
  assert.ok(englishPreloads.some((node) => /Inter-Latin\.[a-f0-9]{8}\.woff2$/.test(node.attrs.href)));
  assert.ok(!englishPreloads.some((node) => /Inter-Latin-Ext/.test(node.attrs.href)), 'English page must not preload the Turkish subset');

  const teamHtmlPath = path.join(distRoot, 'our-team/index.html');
  assert.ok(fs.existsSync(teamHtmlPath), 'nested fixture page from a different source directory must be emitted');
  const teamNodes = nodeList(parse5.parse(fs.readFileSync(teamHtmlPath, 'utf8')));
  const aboutImage = pageNodes.find((node) => node.tag === 'img' && node.attrs.alt === 'Shared wrapper fixture');
  const teamImage = teamNodes.find((node) => node.tag === 'img' && node.attrs.alt === 'Shared wrapper fixture');
  assert.ok(aboutImage && teamImage, 'both generated wrappers must resolve the shared image');
  assert.equal(aboutImage.attrs.src, teamImage.attrs.src, 'wrappers from different directories must emit the same aliased image URL');
  assert.match(aboutImage.attrs.src, /wrapper-shared\.[a-f0-9]{8}\.svg$/);
  assert.ok(fs.existsSync(fileForAsset(distRoot, aboutImage.attrs.src)), 'the shared aliased image must exist in the compiled output');
}

function inspectMalformedIntegration(distRoot) {
  const html = fs.readFileSync(path.join(distRoot, 'index.html'), 'utf8');
  const nodes = nodeList(parse5.parse(html));
  const links = nodes.filter((node) => node.tag === 'link');
  const stylesheets = links.filter((node) => node.attrs.rel === 'stylesheet').map((node) => node.attrs.href);
  const text = nodes.map((node) => node.text).join(' ');
  assert.match(text, /Orbit/);
  assert.doesNotMatch(text, /Northstar Studio/);
  assert.doesNotMatch(html, /project-override-qa\/brand\.svg/);
  assert.ok(stylesheets.every((href) => !/project-(?:tokens|custom)\./.test(href)));
  assert.match(text, /Studio/);
  assert.doesNotMatch(text, /Our studio/);
  assert.ok(fs.existsSync(path.join(distRoot, 'tr/about-our-studio/index.html')), 'valid page remains available at its locale-prefixed route when unrelated config falls back');
  assert.ok(fs.existsSync(path.join(distRoot, 'our-team/index.html')), 'second wrapper fixture remains available when unrelated config falls back');
}

try {
  const missing = loadProjectOverrides({ repoRoot: root, demoId: 'saas', warningSink: (message) => warnings.push(message) });
  assert.equal(missing.brand.name, 'Orbit');
  assert.equal(missing.brand.logo, null);
  assert.equal(missing.tokensScssPath, null);
  assert.equal(missing.customScssPath, null);
  assert.deepEqual(missing.navigation.items, []);
  assert.deepEqual(missing.pageRecords, []);

  write('public/customer/brand.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1H0z"/></svg>');
  json(override('brand.json'), { name: 'Northstar Studio', logo: 'customer/brand.svg' });
  json(override('theme.json'), {
    themes: {
      default: {
        light: { '--color-accent': '#145f59', '--color-accent-rgb': '20, 95, 89' },
        dark: { '--color-accent': '#75d6c9' },
      },
    },
  });
  json(override('navigation.json'), {
    items: [{ pageId: 'customer.about', label: 'Our studio', groups: ['main', 'footer'], order: 3 }],
    external: [],
  });
  write(override('custom.scss'), '.customer-banner { color: #145f59; padding: 1rem; }\n');
  write(override('assets/wrapper-shared.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1H0z"/></svg>');
  write(override('pages/about/page.pug'), 'section(aria-labelledby="custom-title")\n  h1#custom-title About our studio\n  a(href=route("saas.home")) Return home\n  img(src=require("@projectSourceOverrides/assets/wrapper-shared.svg"), alt="Shared wrapper fixture", width="1", height="1")\n');
  json(override('pages/about/page.json'), {
    id: 'customer.about',
    route: '/about-our-studio/',
    source: `${override('pages/about/page.pug')}`,
    title: 'About our studio',
    locale: 'en',
  });
  write(override('pages/team/leadership/page.pug'), 'section(aria-labelledby="team-title")\n  h1#team-title Our team\n  img(src=require("@projectSourceOverrides/assets/wrapper-shared.svg"), alt="Shared wrapper fixture", width="1", height="1")\n');
  json(override('pages/team/leadership/page.json'), {
    id: 'customer.team',
    route: '/our-team/',
    source: `${override('pages/team/leadership/page.pug')}`,
    title: 'Our team',
    locale: 'en',
  });

  const valid = loadProjectOverrides({ repoRoot: root, demoId: 'saas', warningSink: (message) => warnings.push(message) });
  assert.equal(valid.brand.name, 'Northstar Studio');
  assert.equal(valid.brand.logo, 'customer/brand.svg');
  assert.ok(valid.brand.logoPath.startsWith(path.join(root, 'public')));
  assert.equal(valid.pageRecords.length, 2);
  assert.equal(valid.pageRecords[0].demoId, 'saas');
  assert.ok(valid.tokensScssPath);
  assert.ok(valid.customScssPath);
  assert.match(fs.readFileSync(valid.tokensScssPath, 'utf8'), /html\[data-theme="default"\]/);
  assert.match(fs.readFileSync(valid.tokensScssPath, 'utf8'), /--color-accent: #145f59;/);
  assert.match(fs.readFileSync(valid.tokensScssPath, 'utf8'), /data-color-scheme="dark"/);
  const compiledCustom = sass.compile(valid.customScssPath, { loadPaths: [valid.overrideRoot] }).css;
  assert.match(compiledCustom, /\.customer-banner/);
  assert.match(compiledCustom, /color:\s*#145f59/);

  const navigation = createNavigation(valid.pageRecords, (pageId) => `/preview/${pageId}/`, valid.navigation);
  assert.deepEqual(navigation.mainNavigation.map(({ pageId, label, href }) => ({ pageId, label, href })), [
    { pageId: 'customer.about', label: 'Our studio', href: '/preview/customer.about/' },
  ]);
  assert.deepEqual(navigation.footerNavigation.map((item) => item.pageId), ['customer.about']);

  assert.throws(() => validateBrand({ name: 'Bad path', logo: '../../outside.svg' }, root), /local image path/);
  json(override('brand.json'), { name: 'Ignored', logo: '../outside.svg' });
  json(override('theme.json'), { themes: { default: { light: { '--color-accent': 'red; } body { display:none' } } } });
  json(override('navigation.json'), { items: [{ pageId: 'customer.about', href: '/free-form-path/' }] });
  write(override('custom.scss'), '.customer-banner { color: ; }\n');
  write(override('pages/broken/page.pug'), 'extends @layouts/base.pug\n');
  json(override('pages/broken/page.json'), {
    id: 'customer.broken', route: '/broken/', source: '../outside.pug', title: 'Broken', locale: 'en',
  });

  const malformed = loadProjectOverrides({ repoRoot: root, demoId: 'saas', warningSink: (message) => warnings.push(message) });
  assert.equal(malformed.brand.name, 'Orbit');
  assert.deepEqual(malformed.themes, {});
  assert.deepEqual(malformed.navigation.items, []);
  assert.deepEqual(malformed.pageRecords.map((page) => page.id), ['customer.about', 'customer.team']);
  assert.equal(malformed.customScssPath, null);
  assert.ok(warnings.length >= 4, `expected fallback warnings, got ${warnings.length}`);

  // Re-reading after repair regenerates the artifact and makes the Sass active again.
  write(override('brand.json'), '{ invalid json');
  write(override('theme.json'), '{ invalid json');
  write(override('navigation.json'), '{ invalid json');
  write(override('custom.scss'), '.customer-banner { color: teal; }\n');
  const repaired = loadProjectOverrides({ repoRoot: root, demoId: 'saas', warningSink: (message) => warnings.push(message) });
  assert.equal(repaired.brand.name, 'Orbit');
  assert.ok(repaired.customScssPath);
  assert.match(sass.compile(repaired.customScssPath).css, /\.customer-banner/);

  const document = fs.readFileSync(path.resolve(__dirname, '../../src/layouts/document.pug'), 'utf8');
  assert.ok(document.indexOf('block head') < document.indexOf('projectThemeStyles'));
  assert.ok(document.indexOf('projectThemeStyles') < document.indexOf('projectCustomStyles'));
  assert.match(document, /href="@fonts\/Inter-Latin\.woff2"/);
  assert.match(document, /pageLocale\.toLowerCase\(\)\.startsWith\("tr"\)/);
  assert.match(document, /@fonts\/Inter-Latin-Ext\.woff2/);
  assert.match(document, /pageId === "system\.404"/);
  const webpackSource = fs.readFileSync(path.resolve(__dirname, '../../webpack.config.js'), 'utf8');
  assert.match(webpackSource, /'@fonts': path\.resolve\(REPO_ROOT, 'src\/assets\/fonts'\)/);
  const devSource = fs.readFileSync(path.resolve(__dirname, '../../scripts/start-dev.cjs'), 'utf8');
  assert.match(devSource, /project\/overrides/);

  const projectDirectory = path.join(repoRoot, 'project');
  const realOverlayRoot = path.join(projectDirectory, 'overrides');
  const publicFixtureRoot = path.join(repoRoot, 'public/project-override-qa');
  const projectDirectoryExisted = fs.existsSync(projectDirectory);
  if (projectDirectoryExisted) {
    const projectStat = fs.lstatSync(projectDirectory);
    assert.ok(projectStat.isDirectory() && !projectStat.isSymbolicLink(), 'project/ must be a regular directory for the integration fixture');
  }
  const overlayExisted = assertFixtureTargetAvailable(realOverlayRoot, { allowEmptyDirectory: true });
  const publicFixtureExisted = assertFixtureTargetAvailable(publicFixtureRoot);
  let fixtureInstalled = false;
  try {
    fs.mkdirSync(realOverlayRoot, { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'public'), { recursive: true });
    fs.mkdirSync(publicFixtureRoot, { recursive: true });
    installIntegrationFixture(realOverlayRoot, publicFixtureRoot);
    fixtureInstalled = true;

    const buildRoot = path.join(root, 'production-build');
    fs.mkdirSync(buildRoot, { recursive: true });
    copyBuildRoot(buildRoot);
    const validBuild = runProductionBuild(buildRoot);
    const manifest = JSON.parse(fs.readFileSync(path.join(buildRoot, '.generated/pages-manifest.json'), 'utf8'));
    assert.ok(manifest.pages.some((page) => page.id === 'customer.about' && page.route === '/tr/about-our-studio/'));
    checkDist(buildRoot, validBuild.environment);
    inspectValidIntegration(validBuild.dist);

    const copiedOverlay = path.join(buildRoot, 'project/overrides');
    fs.writeFileSync(path.join(copiedOverlay, 'brand.json'), '{ invalid json');
    fs.writeFileSync(path.join(copiedOverlay, 'theme.json'), '{ invalid json');
    fs.writeFileSync(path.join(copiedOverlay, 'navigation.json'), JSON.stringify({ items: [{ pageId: 'saas.features', href: '/unvalidated/' }] }));
    fs.writeFileSync(path.join(copiedOverlay, 'custom.scss'), '.broken { color: ; }\n');
    const fallbackBuild = runProductionBuild(buildRoot);
    checkDist(buildRoot, fallbackBuild.environment);
    inspectMalformedIntegration(fallbackBuild.dist);

  } finally {
    if (fixtureInstalled) {
      if (!overlayExisted) fs.rmSync(realOverlayRoot, { recursive: true, force: true });
      else {
        for (const relative of ['brand.json', 'theme.json', 'navigation.json', 'custom.scss', 'assets/wrapper-shared.svg', 'pages/about/page.json', 'pages/about/page.pug', 'pages/about/page.scss', 'pages/about/page.js', 'pages/team/leadership/page.json', 'pages/team/leadership/page.pug']) {
          fs.rmSync(path.join(realOverlayRoot, relative), { force: true });
        }
        for (const relative of ['assets', 'pages/team/leadership', 'pages/team', 'pages/about', 'pages']) {
          removeEmptyDirectory(path.join(realOverlayRoot, relative));
        }
      }
      if (!publicFixtureExisted) fs.rmSync(publicFixtureRoot, { recursive: true, force: true });
      if (!projectDirectoryExisted) {
        removeEmptyDirectory(projectDirectory);
      }
    }
  }

  if (cleanupFailed) {
    process.exitCode = 1;
  } else {
    process.stdout.write('Project override QA passed: defaults, brand/logo containment, semantic tokens, compiled custom Sass, route-backed navigation, page discovery, malformed fallback, repair refresh, and isolated production integration.\n');
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
