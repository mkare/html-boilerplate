#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { loadPages } = require('../../build/pages/manifest.cjs');
const { getSiteConfig } = require('../../config/site.config.cjs');

const root = path.resolve(__dirname, '../..');
const inventoryPath = path.resolve(process.env.ROUTE_INVENTORY_PATH || path.join(root, 'docs/architecture/phase-0/route-inventory.md'));
const buildNow = '2026-10-03T12:00:00.000Z';
const startMarker = '<!-- GENERATED CATALOG ROUTE INVENTORY: START -->';
const endMarker = '<!-- GENERATED CATALOG ROUTE INVENTORY: END -->';

function cell(value) {
  const content = value == null || value === '' ? '—' : String(value);
  return `\`${content.replaceAll('|', '\\|')}\``;
}

function sourceList(value) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map(cell).join('<br>') || '—';
}

function renderSection() {
  const env = { SITE_URL: 'https://route-inventory.example.test', BASE_PATH: '/' };
  const site = getSiteConfig({ ...env, BUILD_DEMO: 'saas' }, root);
  const { pages } = loadPages({ buildNow, site, profile: 'catalog-preview' });
  const legacyCount = pages.filter((page) => page.source.startsWith('src/views/')).length;
  const sourcePageCount = pages.filter((page) => page.source.startsWith('src/pages/')).length;
  const systemCount = pages.length - legacyCount - sourcePageCount;
  const customerCounts = ['saas', 'agency'].map((demoId) => {
    const customerSite = getSiteConfig({ ...env, BUILD_DEMO: demoId }, root);
    const result = loadPages({ buildNow, site: customerSite, profile: 'customer-production' });
    const pageCount = result.pages.filter((page) => page.output !== '404.html').length;
    return `${demoId} \`${result.pages.length}\` outputs (${pageCount} demo routes + 404)`;
  });
  const rows = pages.map((page) => {
    const output = path.posix.join('dist', page.output);
    const direction = page.direction || 'ltr';
    return `| ${cell(page.id)} | ${cell(page.route)} | ${cell(output)} | ${cell(page.source)} | ${sourceList(page.styles)} | ${cell(page.script)} | ${cell(page.layout)} | ${cell(`${page.locale}/${direction}`)} |`;
  });

  return [
    startMarker,
    '## Güncel katalog preview route matrisi',
    '',
    `Manifest ve koleksiyonlardan üretildi; sabit \`buildNow=${buildNow}\`, profil \`catalog-preview\`. Bu snapshot **${pages.length} route/output** içerir: ${legacyCount} legacy \`src/views/**\` entry’si, ${sourcePageCount} \`src/pages/**\` manifest/content instance’ı ve ${systemCount} sistem route’u. Aynı kaynakların customer-profile kapsamı: ${customerCounts.join('; ')}. Bu sayılar Faz 0 başlangıç ölçümündeki 11 HTML sayfasıyla aynı kapsam değildir.`,
    '',
    '| Page ID | Kanonik route | Output | Pug source | CSS source | JS entry | Layout | Locale/direction |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    endMarker,
  ].join('\n');
}

function replaceSection(document, section) {
  const start = document.indexOf(startMarker);
  const end = document.indexOf(endMarker);
  if (start === -1 && end === -1) return `${document.trimEnd()}\n\n${section}\n`;
  if (start === -1 || end === -1 || end < start) throw new Error('Route inventory markers are missing or out of order.');
  const endAfterMarker = end + endMarker.length;
  return `${document.slice(0, start)}${section}${document.slice(endAfterMarker)}`;
}

function main() {
  const current = fs.readFileSync(inventoryPath, 'utf8');
  const expected = replaceSection(current, renderSection());
  if (process.argv.includes('--self-test-stale')) {
    const staleFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'route-inventory-stale-'));
    const staleFixture = path.join(staleFixtureRoot, 'route-inventory.md');
    try {
      const staleDocument = current.replace('| `legacy.home` | `/` |', '| `legacy.home` | `/stale-route/` |');
      if (staleDocument === current) throw new Error('Could not create a stale route inventory fixture.');
      fs.writeFileSync(staleFixture, staleDocument);
      const check = spawnSync(process.execPath, [__filename], {
        cwd: root,
        env: { ...process.env, ROUTE_INVENTORY_PATH: staleFixture },
        encoding: 'utf8',
      });
      if (check.status !== 1 || !/Route inventory is stale/.test(check.stderr || '')) {
        throw new Error(`Stale fixture was not rejected (status ${check.status}).\n${check.stdout || ''}\n${check.stderr || ''}`);
      }
      process.stdout.write('Route inventory stale-fixture check passed: altered route was rejected.\n');
    } finally {
      fs.rmSync(staleFixtureRoot, { recursive: true, force: true });
    }
    return;
  }
  if (process.argv.includes('--write') || process.argv.includes('--fix')) {
    fs.writeFileSync(inventoryPath, expected);
    process.stdout.write(`Updated route inventory: ${path.relative(root, inventoryPath)}.\n`);
    return;
  }
  if (expected !== current) {
    process.stderr.write('Route inventory is stale. Run `node qa/phase-0/check-route-inventory.cjs --write` and review the diff.\n');
    process.exitCode = 1;
    return;
  }
  const count = (expected.match(/^\| `[^`]+` \| `\//gm) || []).length;
  process.stdout.write(`Route inventory passed: ${count} manifest routes; buildNow ${buildNow}; catalog-preview.\n`);
}

main();
