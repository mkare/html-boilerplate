#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const fontsDir = path.join(root, 'src/assets/fonts');
const files = ['Inter-Latin.woff2', 'Inter-Latin-Ext.woff2'];
const sizes = files.map((file) => {
  const bytes = fs.readFileSync(path.join(fontsDir, file));
  assert.equal(bytes.toString('ascii', 0, 4), 'wOF2', `${file} must be WOFF2`);
  return bytes.length;
});
assert.ok(sizes.reduce((sum, size) => sum + size, 0) <= 120 * 1024, 'font source assets must stay within 120 KiB');

const license = fs.readFileSync(path.join(fontsDir, 'OFL-Inter.txt'), 'utf8');
assert.match(license, /SIL OPEN FONT LICENSE/i);
const styles = fs.readFileSync(path.join(root, 'src/scss/theme.scss'), 'utf8');
assert.equal((styles.match(/@font-face/g) || []).length, 2, 'both local subsets must be declared');
assert.equal((styles.match(/font-display:\s*swap/g) || []).length, 2, 'both subsets must swap while loading');
assert.equal((styles.match(/font-weight:\s*100\s+900/g) || []).length, 2, 'both subsets must expose the variable weight range');
assert.match(styles, /\.\.\/assets\/fonts\/Inter-Latin\.woff2/);
assert.match(styles, /\.\.\/assets\/fonts\/Inter-Latin-Ext\.woff2/);
assert.match(styles, /U\+0130-0131/);
assert.match(styles, /U\+015E-015F/);
assert.match(styles, /U\+0000-00FF/);
assert.doesNotMatch(styles, /fonts\.(?:googleapis|gstatic)\.com/i, 'font CSS must not call a remote font host');

const dist = path.join(root, 'dist');
if (fs.existsSync(dist)) {
  const outputFiles = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else outputFiles.push(absolute);
    }
  };
  visit(dist);
  for (const font of files) {
    const stem = font.replace(/\.woff2$/, '');
    assert.ok(outputFiles.some((file) => new RegExp(`${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.[a-f0-9]{8}\\.woff2$`).test(path.relative(dist, file))), `${font} must be emitted with a content hash`);
  }
  for (const cssPath of outputFiles.filter((file) => file.endsWith('.css'))) {
    const css = fs.readFileSync(cssPath, 'utf8');
    const fontFaces = css.match(/@font-face\s*\{[^}]*font-family\s*:\s*Inter[^}]*\}/g) || [];
    if (fontFaces.length === 0) continue;
    assert.equal(fontFaces.length, 2, `${path.relative(dist, cssPath)} must declare both local Inter subsets`);
    assert.doesNotMatch(css, /fonts\.(?:googleapis|gstatic)\.com/i, 'emitted CSS must not link a remote font host');
    assert.match(fontFaces[0], /Inter-Latin(?:-Ext)?\.[a-f0-9]{8}\.woff2/);
    assert.match(fontFaces[1], /Inter-Latin(?:-Ext)?\.[a-f0-9]{8}\.woff2/);
  }

  const manifestPath = path.join(root, '.generated/pages-manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const page of manifest.pages || []) {
      const filename = path.join(dist, ...page.output.split('/'));
      if (!fs.existsSync(filename)) continue;
      const html = fs.readFileSync(filename, 'utf8');
      const language = /<html\b[^>]*\blang=["']([^"']+)/i.exec(html)?.[1] || '';
      const preloads = [...html.matchAll(/<link\b[^>]*\brel=["']preload["'][^>]*>/gi)].map(([tag]) => tag);
      const fontPreloads = preloads.filter((tag) => /\bas=["']font["']/.test(tag));
      assert.equal(fontPreloads.filter((tag) => /Inter-Latin\.[a-f0-9]{8}\.woff2/.test(tag)).length, 1, `${page.output} must preload the Latin subset once`);
      const hasTurkishSubset = fontPreloads.some((tag) => /Inter-Latin-Ext\.[a-f0-9]{8}\.woff2/.test(tag));
      assert.equal(hasTurkishSubset, language.toLowerCase().startsWith('tr'), `${page.output} must preload the Turkish subset only for Turkish pages`);
      assert.ok(fontPreloads.every((tag) => /\bcrossorigin=["']anonymous["']/.test(tag)), `${page.output} font preloads need crossorigin=anonymous`);
    }
  }
}

console.log(`Font assets passed: ${sizes.reduce((sum, size) => sum + size, 0)} bytes source WOFF2; OFL and local subset CSS verified${fs.existsSync(dist) ? '; hashed distribution files verified' : ''}.`);
