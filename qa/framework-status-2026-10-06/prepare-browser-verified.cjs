const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const evidence = path.join(__dirname, 'browser-verified');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'framework-visual-verified-'));
for (const entry of ['src', 'build', 'config', 'public', 'project/overrides', 'webpack.config.js', 'package.json', '.browserslistrc', '.nvmrc', 'scripts/preview.cjs']) {
  const source = path.join(root, entry);
  if (!fs.existsSync(source)) continue;
  fs.mkdirSync(path.dirname(path.join(fixture, entry)), { recursive: true });
  fs.cpSync(source, path.join(fixture, entry), { recursive: true });
}
fs.symlinkSync(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'dir');
fs.writeFileSync(path.join(evidence, 'preview-root.txt'), fixture + '\n');
const result = spawnSync(process.execPath, [path.join(fixture, 'node_modules/webpack-cli/bin/cli.js'), 'build', '--mode', 'production', '--env', 'profile=catalog-preview'], {
  cwd: fixture,
  env: { ...process.env, BUILD_NOW: '2026-10-03T12:00:00.000Z', BASE_PATH: '/', ASSET_BASE: '/' },
  encoding: 'utf8',
});
fs.writeFileSync(path.join(evidence, 'preview-build.log'), (result.stdout || '') + (result.stderr || ''));
if (result.error) throw result.error;
process.stdout.write(JSON.stringify({ fixture, exitCode: result.status }) + '\n');
process.exitCode = result.status ?? 1;
