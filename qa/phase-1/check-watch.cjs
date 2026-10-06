#!/usr/bin/env node
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const fixtureId = 'qa.watch.' + process.pid;
const fixtureRoute = '/__watch_acceptance__/' + process.pid + '/';
const sitemapOrigin = 'https://watch-acceptance.example';
const fixtureDir = path.join(root, 'src/pages', '__watch_acceptance_' + process.pid);
const manifestPath = path.join(fixtureDir, 'page.json');
const pageDataPath = path.join(fixtureDir, 'page.data.cjs');
const nestedDataPath = path.join(fixtureDir, 'nested-data.cjs');
const projectRoot = path.join(root, 'project');
const overrideRoot = path.join(projectRoot, 'overrides');
const projectRootExisted = fs.existsSync(projectRoot);
const overrideRootExisted = fs.existsSync(overrideRoot);
const outputSnapshotRoot = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'watch-acceptance-'));
const outputSnapshots = ['dist', '.generated'].map((relative) => {
  const target = path.join(root, relative);
  const backup = path.join(outputSnapshotRoot, relative.replace(/[/.]/g, '_'));
  const existed = fs.existsSync(target);
  if (existed) fs.cpSync(target, backup, { recursive: true, dereference: false, preserveTimestamps: true });
  return { target, backup, existed };
});
const pugPath = path.join(fixtureDir, 'page.pug');
let port;
let child;
let childOutput = '';
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

function reservePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const address = socket.address();
      socket.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

function pageRecord(options = {}) {
  const title = options.title || 'Watcher fixture v1';
  return {
    id: options.id || fixtureId,
    route: options.route || fixtureRoute,
    source: path.relative(root, pugPath).split(path.sep).join('/'),
    data: path.relative(root, pageDataPath).split(path.sep).join('/'),
    requiredByDemos: ['saas'],
    layout: 'minimal',
    theme: 'default',
    locale: 'en',
    direction: 'ltr',
    title,
    navigation: { groups: ['main'], label: title, order: 99 },
  };
}

function writeFixture(record) {
  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(pugPath, 'extends @layouts/minimal.pug\n\nblock content\n  h1 ' + record.title + '\n  p#watch-message= watchMessage\n');
  fs.writeFileSync(pageDataPath, 'module.exports = { watchMessage: require("./nested-data.cjs").message };\n');
  if (!fs.existsSync(nestedDataPath)) {
    fs.writeFileSync(nestedDataPath, 'module.exports = { message: "Nested data v1" };\n');
  }
  fs.writeFileSync(manifestPath, JSON.stringify(record, null, 2) + '\n');
}

async function waitFor(predicate, message, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await predicate();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
  throw new Error(message + (lastError ? ' Last error: ' + lastError.message : '') + '\n' + childOutput.slice(-2400));
}

async function request(url) {
  return fetch(url, { cache: 'no-store', redirect: 'manual' });
}

async function expectRoute(url, title, expectedMessage = null) {
  return waitFor(async () => {
    const response = await request(url);
    const html = await response.text();
    const includesCurrentData = expectedMessage === null || html.includes('<p id="watch-message">' + expectedMessage + '</p>');
    return response.status === 200 && html.includes('<h1>' + title + '</h1>') && includesCurrentData ? html : false;
  }, 'Expected ' + url + ' to serve "' + title + '".');
}

async function expectMissing(url) {
  let lastStatus = 'unavailable';
  let lastBody = '';
  try {
    return await waitFor(async () => {
      const response = await request(url);
      lastStatus = response.status;
      lastBody = (await response.text()).slice(0, 300);
      return response.status === 404;
    }, 'Expected ' + url + ' to be removed from the watched build.', 12000);
  } catch (error) {
    throw new Error(error.message + '\nLast response: ' + lastStatus + ' ' + lastBody, { cause: error });
  }
}

async function expectNavigation(url, title, present) {
  return waitFor(async () => {
    const response = await request(url);
    const html = (await response.text()).replace(/\s+/g, ' ');
    return (response.status === 200 && html.includes('>' + title + '</a>')) === present;
  }, 'Expected navigation label "' + title + '" presence=' + present + ' at ' + url + '.');
}

async function readSitemap(baseUrl) {
  return waitFor(async () => {
    const response = await request(baseUrl + 'sitemap.xml');
    if (response.status !== 200) return false;
    return response.text();
  }, 'Expected the customer-profile sitemap to be served.');
}

async function expectSitemapEntry(baseUrl, route, present) {
  const location = '<loc>' + sitemapOrigin + route + '</loc>';
  return waitFor(async () => {
    const response = await request(baseUrl + 'sitemap.xml');
    if (response.status !== 200) return false;
    const sitemap = await response.text();
    return sitemap.includes(location) === present ? sitemap : false;
  }, 'Expected sitemap entry "' + location + '" presence=' + present + '.');
}

async function expectSitemapUnchanged(baseUrl, expected, reason) {
  return waitFor(async () => {
    const response = await request(baseUrl + 'sitemap.xml');
    if (response.status !== 200) return false;
    return (await response.text()) === expected;
  }, 'Expected sitemap to remain unchanged after ' + reason + '.');
}

async function stopChild() {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 5000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}

async function main() {
  port = await reservePort();
  const rootUrl = 'http://127.0.0.1:' + port + '/';
  const serverEnv = {
    ...process.env,
    PORT: String(port),
    OPEN_BROWSER: '0',
    BUILD_PROFILE: 'customer-production',
    SITE_URL: sitemapOrigin,
  };
  child = spawn(process.execPath, ['scripts/start-dev.cjs'], { cwd: root, env: serverEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk) => { childOutput += chunk.toString(); });
  child.stderr.on('data', (chunk) => { childOutput += chunk.toString(); });

  try {
    await waitFor(async () => (await request(rootUrl)).status === 200, 'Development server did not become ready.');

    await expectSitemapEntry(rootUrl, fixtureRoute, false);
    const first = pageRecord();
    writeFixture(first);
    await expectRoute(rootUrl.replace(/\/$/, '') + first.route, first.title, 'Nested data v1');
    await expectNavigation(rootUrl, first.title, true);
    await expectSitemapEntry(rootUrl, first.route, true);

    const sitemapBeforeDataEdit = await readSitemap(rootUrl);
    fs.writeFileSync(nestedDataPath, 'module.exports = { message: "Nested data v2" };\n');
    await expectRoute(rootUrl.replace(/\/$/, '') + first.route, first.title, 'Nested data v2');
    await expectSitemapUnchanged(rootUrl, sitemapBeforeDataEdit, 'a nested page-data edit');

    const renamed = pageRecord({
      id: fixtureId + '.renamed',
      route: fixtureRoute + 'renamed/',
      title: 'Watcher fixture renamed',
    });
    writeFixture(renamed);
    await expectRoute(rootUrl.replace(/\/$/, '') + renamed.route, renamed.title, 'Nested data v2');
    await expectMissing(rootUrl.replace(/\/$/, '') + first.route);
    await expectNavigation(rootUrl, first.title, false);
    await expectNavigation(rootUrl, renamed.title, true);
    await expectSitemapEntry(rootUrl, first.route, false);
    await expectSitemapEntry(rootUrl, renamed.route, true);

    const sitemapBeforeInvalidManifest = await readSitemap(rootUrl);
    fs.writeFileSync(manifestPath, '{ invalid json');
    await waitFor(() => /Invalid JSON|SyntaxError|Unexpected end/i.test(childOutput),
      'Invalid page JSON was not reported by the watcher.');
    await expectRoute(rootUrl.replace(/\/$/, '') + renamed.route, renamed.title);
    await expectSitemapUnchanged(rootUrl, sitemapBeforeInvalidManifest, 'an invalid manifest edit');

    const repaired = pageRecord({
      id: fixtureId + '.repaired',
      route: fixtureRoute + 'repaired/',
      title: 'Watcher fixture repaired',
    });
    writeFixture(repaired);
    await expectRoute(rootUrl.replace(/\/$/, '') + repaired.route, repaired.title, 'Nested data v2');
    await expectMissing(rootUrl.replace(/\/$/, '') + renamed.route);
    await expectSitemapEntry(rootUrl, renamed.route, false);
    await expectSitemapEntry(rootUrl, repaired.route, true);

    fs.unlinkSync(manifestPath);
    await expectMissing(rootUrl.replace(/\/$/, '') + repaired.route);
    await expectNavigation(rootUrl, repaired.title, false);
    await expectSitemapEntry(rootUrl, repaired.route, false);
  } finally {
    await stopChild();
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    for (const { target, backup, existed } of outputSnapshots) {
      if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
      if (existed) fs.cpSync(backup, target, { recursive: true, dereference: false, preserveTimestamps: true });
    }
    if (!overrideRootExisted) {
      removeEmptyDirectory(overrideRoot);
    }
    if (!projectRootExisted) {
      removeEmptyDirectory(projectRoot);
    }
    fs.rmSync(outputSnapshotRoot, { recursive: true, force: true });
  }
  if (cleanupFailed) {
    process.exitCode = 1;
    return;
  }
  process.stdout.write('Manifest watcher acceptance passed: add, nested CJS data edit/reload, route rename, invalid JSON retention, repair, remove, and synchronized primary navigation.\n');
}

main().catch((error) => {
  process.stderr.write((error.stack || error) + '\n');
  process.exitCode = 1;
});
