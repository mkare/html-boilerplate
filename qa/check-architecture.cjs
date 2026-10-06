const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(repoRoot, 'src');
const aliases = new Map([
  ['@core', 'src/core'],
  ['@styles', 'src/styles'],
  ['@ui', 'src/ui'],
  ['@features', 'src/features'],
  ['@blocks', 'src/blocks'],
  ['@layouts', 'src/layouts'],
  ['@pages', 'src/pages'],
  ['@themes', 'src/themes'],
  ['@content', 'src/content'],
  ['@scss', 'src/scss'],
  ['@js', 'src/js'],
]);
const sourceExtensions = new Set(['.js', '.mjs', '.cjs', '.pug', '.scss']);
const sourceRoots = [
  'src/core', 'src/layouts', 'src/themes', 'src/content',
  'src/ui', 'src/features', 'src/blocks', 'src/pages', 'src/views',
]
  .map((relative) => path.join(repoRoot, relative));
const issues = [];
let filesChecked = 0;

function walk(directory, found = []) {
  if (!fs.existsSync(directory)) return found;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, found);
    else if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) found.push(absolute);
  }
  return found;
}

function inside(parent, target) {
  const relative = path.relative(parent, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function resolveSpecifier(specifier, ownerFile) {
  for (const [alias, root] of aliases) {
    if (specifier === alias || specifier.startsWith(`${alias}/`)) {
      return path.resolve(repoRoot, root, specifier.slice(alias.length).replace(/^\//, ''));
    }
  }
  if (specifier.startsWith('.')) return path.resolve(path.dirname(ownerFile), specifier);
  return null;
}

function getSpecifiers(source, extension) {
  const specifiers = [];
  if (extension === '.pug') {
    for (const match of source.matchAll(/^\s*(?:include|extends)\s+([^\s]+)\s*$/gm)) {
      if (!match[1].startsWith('//')) specifiers.push(match[1].replace(/^['"]|['"]$/g, ''));
    }
  }
  if (['.js', '.mjs', '.cjs', '.pug'].includes(extension)) {
    const pattern = /\b(?:from\s*|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g;
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  if (extension === '.scss') {
    const pattern = /@(?:use|forward|import)\s+['"]([^'"]+)['"]/g;
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return [...new Set(specifiers)];
}

function layerFor(file) {
  const relative = path.relative(srcRoot, file).split(path.sep).join('/');
  const [top, name] = relative.split('/');
  if (top === 'pages') return { name: top, packRoot: path.join(srcRoot, top, name || '') };
  if (['ui', 'features', 'blocks'].includes(top)) return { name: top, packRoot: path.join(srcRoot, top, name || '') };
  if (['core', 'layouts', 'themes', 'content'].includes(top)) return { name: top, packRoot: path.join(srcRoot, top) };
  if (top === 'views') return { name: 'legacy-views', packRoot: path.join(srcRoot, top) };
  return null;
}

function boundaryIssuesFor({ owner, targetTop, target, specifier, relative }) {
  if (!owner) return [];
  const issues = [];
  if (owner.name === 'ui' && ['pages', 'features', 'blocks', 'content'].includes(targetTop)) {
    issues.push(`${relative}: UI cannot depend on ${targetTop} (${specifier}).`);
  }
  if (owner.name === 'core' && ['ui', 'features', 'blocks', 'layouts', 'themes', 'pages', 'views', 'content'].includes(targetTop)) {
    issues.push(`${relative}: core cannot depend on ${targetTop} (${specifier}).`);
  }
  if (owner.name === 'themes' && ['features', 'blocks', 'layouts', 'pages', 'views', 'content'].includes(targetTop)) {
    issues.push(`${relative}: themes cannot depend on ${targetTop} (${specifier}).`);
  }
  if (owner.name === 'layouts' && ['features', 'pages', 'views', 'content'].includes(targetTop)) {
    issues.push(`${relative}: layouts cannot depend on ${targetTop} (${specifier}).`);
  }
  if (owner.name === 'features') {
    if (['pages', 'blocks', 'layouts', 'themes'].includes(targetTop)) {
      issues.push(`${relative}: feature cannot depend on ${targetTop} (${specifier}).`);
    }
    if (targetTop === 'features' && !inside(owner.packRoot, target)) {
      issues.push(`${relative}: features cannot depend on another feature's private files (${specifier}).`);
    }
  }
  if (owner.name === 'blocks' && targetTop === 'pages') {
    issues.push(`${relative}: block cannot depend on a page (${specifier}).`);
  }
  if (owner.name === 'pages' && targetTop === 'pages' && !inside(owner.packRoot, target)) {
    issues.push(`${relative}: a demo page cannot depend on another page pack (${specifier}).`);
  }
  if (owner.name === 'pages' && targetTop === 'ui' && /(?:^|\/)(?:internal|private|implementation)(?:\/|\.|$)/i.test(path.relative(path.join(srcRoot, 'ui'), target).split(path.sep).join('/'))) {
    issues.push(`${relative}: page imports a private UI implementation path (${specifier}).`);
  }
  return issues;
}

for (const file of sourceRoots.flatMap((root) => walk(root)).sort()) {
  filesChecked += 1;
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(repoRoot, file).split(path.sep).join('/');
  const owner = layerFor(file);

  if (['src/pages/', 'src/blocks/', 'src/ui/'].some((root) => relative.startsWith(root)) && path.extname(file) === '.pug') {
    const relativeAsset = /(?:^|\s)(?:src|href|poster|srcset)\s*=\s*['"](?:\.\.\/|\.\/)/m;
    if (relativeAsset.test(source)) issues.push(`${relative}: use a source alias or asset helper for Pug assets; generated wrappers resolve from .generated/.`);
  }

  if (/\b(?:\.innerHTML\s*=|insertAdjacentHTML\s*\(|document\.write\s*\()/i.test(source)) {
    issues.push(`${relative}: use textContent or DOM node creation instead of HTML string insertion.`);
  }

  for (const specifier of getSpecifiers(source, path.extname(file))) {
    const target = resolveSpecifier(specifier, file);
    if (!target || !owner) continue;
    const targetRelative = path.relative(srcRoot, target).split(path.sep).join('/');
    const targetTop = targetRelative.split('/')[0];

    issues.push(...boundaryIssuesFor({ owner, targetTop, target, specifier, relative }));
  }
}

for (const probe of [
  {
    label: 'page-to-other-page',
    owner: { name: 'pages', packRoot: path.join(srcRoot, 'pages', 'saas') },
    targetTop: 'pages', target: path.join(srcRoot, 'pages', 'agency', 'home', 'page.pug'),
    specifier: '@pages/agency/home/page.pug', shouldReject: true,
  },
  {
    label: 'page-to-public-ui-entry',
    owner: { name: 'pages', packRoot: path.join(srcRoot, 'pages', 'saas') },
    targetTop: 'ui', target: path.join(srcRoot, 'ui', 'atoms', 'button', 'button.pug'),
    specifier: '@ui/atoms/button/button.pug', shouldReject: false,
  },
  {
    label: 'page-to-private-ui-entry',
    owner: { name: 'pages', packRoot: path.join(srcRoot, 'pages', 'saas') },
    targetTop: 'ui', target: path.join(srcRoot, 'ui', 'atoms', 'button', 'internal', 'state.js'),
    specifier: '@ui/atoms/button/internal/state.js', shouldReject: true,
  },
  {
    label: 'ui-to-page',
    owner: { name: 'ui', packRoot: path.join(srcRoot, 'ui', 'atoms', 'button') },
    targetTop: 'pages', target: path.join(srcRoot, 'pages', 'saas', 'home', 'page.pug'),
    specifier: '@pages/saas/home/page.pug', shouldReject: true,
  },
  {
    label: 'layout-to-content',
    owner: { name: 'layouts', packRoot: path.join(srcRoot, 'layouts') },
    targetTop: 'content', target: path.join(srcRoot, 'content', 'blog', 'posts.cjs'),
    specifier: '@content/blog/posts.cjs', shouldReject: true,
  },
  {
    label: 'block-to-feature',
    owner: { name: 'blocks', packRoot: path.join(srcRoot, 'blocks', 'marketing', 'newsletter-signup') },
    targetTop: 'features', target: path.join(srcRoot, 'features', 'newsletter', 'form-controller.js'),
    specifier: '@features/newsletter/form-controller', shouldReject: false,
  },
]) {
  const found = boundaryIssuesFor({ ...probe, relative: probe.label }).length > 0;
  if (found !== probe.shouldReject) issues.push(`architecture edge rule probe ${probe.label} returned ${found}; expected ${probe.shouldReject}.`);
}

if (issues.length) {
  process.stderr.write(`architecture check found ${issues.length} issue(s):\n`);
  issues.forEach((issue) => process.stderr.write(`- ${issue}\n`));
  process.exitCode = 1;
} else {
  process.stdout.write(`architecture source boundaries passed: ${filesChecked} source files checked.\n`);
}
