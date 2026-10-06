const assert = require('node:assert/strict');
const path = require('node:path');
const autoprefixer = require('autoprefixer');
const browserslist = require('browserslist');
const postcss = require('postcss');
const { createWebpackConfig } = require('../webpack.config.js');

async function main() {
  const root = path.resolve(__dirname, '..');
  const queries = browserslist.loadConfig({ path: root });
  assert.ok(queries?.length, 'the root .browserslistrc must provide compatibility queries');

  const cliTargets = browserslist(queries, { path: root });
  assert.ok(cliTargets.length, 'Browserslist CLI targets must resolve to at least one browser');

  const fixturePath = path.join(root, 'src/scss/.autoprefixer-check.css');
  const fixture = ':root { appearance: none; user-select: none; }';
  const automatic = await postcss([autoprefixer()]).process(fixture, { from: fixturePath, map: false });
  const explicit = await postcss([autoprefixer({ overrideBrowserslist: cliTargets })])
    .process(fixture, { from: fixturePath, map: false });

  assert.equal(automatic.css, explicit.css, 'Autoprefixer and the CLI must resolve the same root Browserslist targets');
  assert.match(automatic.css, /-webkit-user-select:\s*none/, 'Autoprefixer must add the prefix required by the configured targets');

  const config = createWebpackConfig({ profile: 'customer-production' }, { mode: 'production' });
  const sassRule = config.module.rules.find((rule) => rule.test?.test('page.scss'));
  const loaders = sassRule?.use || [];
  const postcssLoader = loaders.find((entry) => typeof entry === 'object' && entry.loader === 'postcss-loader');
  const plugin = postcssLoader?.options?.postcssOptions?.plugins?.find((entry) => entry.postcssPlugin === 'autoprefixer');

  assert.ok(postcssLoader, 'Webpack Sass rules must include postcss-loader');
  assert.ok(plugin, 'Webpack PostCSS options must install Autoprefixer');
  assert.deepEqual(loaders.map((entry) => typeof entry === 'string' ? entry : entry.loader), [
    'css-loader',
    'postcss-loader',
    'sass-loader',
  ], 'Webpack must compile Sass before prefixing and CSS bundling');

  process.stdout.write(`Autoprefixer acceptance passed: ${queries.length} shared queries resolve ${cliTargets.length} browser targets; Webpack uses the same implicit .browserslistrc.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
