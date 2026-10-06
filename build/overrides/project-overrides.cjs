const fs = require('node:fs');
const path = require('node:path');
const sass = require('sass');

const PROJECT_OVERRIDE_DIR = 'project/overrides';
const GENERATED_OVERRIDE_DIR = '.generated/project-overrides';
const MAX_JSON_BYTES = 64 * 1024;
const MAX_SCSS_BYTES = 256 * 1024;
const MAX_OVERRIDE_PAGES = 100;
const SUPPORTED_THEMES = new Set(['default', 'commerce']);
const PUBLIC_TOKENS = new Set([
  '--font-family-sans', '--font-family-mono',
  '--color-bg', '--color-bg-rgb', '--color-surface', '--color-surface-rgb', '--color-surface-subtle',
  '--color-text', '--color-text-rgb', '--color-muted', '--color-muted-rgb',
  '--color-accent', '--color-accent-rgb', '--color-accent-strong', '--color-accent-strong-rgb',
  '--color-on-accent', '--color-border', '--color-positive', '--color-warning', '--color-danger',
  '--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--shadow-soft', '--shadow-card',
  '--transition-fast', '--page-gutter',
]);

function containsControlCharacter(value) {
  return Array.from(value).some((character) => {
    const code = character.codePointAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}
const DEFAULT_EXTERNAL_NAVIGATION = Object.freeze([
  { id: 'social.instagram', label: 'instagram', href: 'https://www.instagram.com/' },
  { id: 'social.facebook', label: 'facebook', href: 'https://www.facebook.com/' },
  { id: 'social.x', label: 'twitter', href: 'https://twitter.com/' },
  { id: 'social.youtube', label: 'youtube', href: 'https://www.youtube.com/' },
]);
const DEFAULT_BRANDS = Object.freeze({ agency: 'Fieldwork', saas: 'Orbit' });

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function assertKeys(value, allowed, label) {
  if (!isPlainObject(value)) throw new Error(`${label} must be a JSON object.`);
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length) throw new Error(`${label} contains unsupported key(s): ${extra.join(', ')}.`);
}

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function containedPath(repoRoot, relative, { mustExist = false, type = null } = {}) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\')
    || relative.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`Expected a repository-relative override path; received "${relative}".`);
  }
  const absolute = path.resolve(repoRoot, relative);
  if (!isWithin(repoRoot, absolute)) throw new Error(`Override path escapes the project: "${relative}".`);

  let current = repoRoot;
  const parts = path.relative(repoRoot, absolute).split(path.sep);
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) {
      if (error.code === 'ENOENT' && !mustExist) return null;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`Override paths cannot follow symbolic links: "${relative}".`);
    const final = index === parts.length - 1;
    if (!final && !stat.isDirectory()) throw new Error(`Override path parent is not a directory: "${relative}".`);
    if (final && type === 'file' && !stat.isFile()) throw new Error(`Override path is not a regular file: "${relative}".`);
    if (final && type === 'directory' && !stat.isDirectory()) throw new Error(`Override path is not a directory: "${relative}".`);
  }

  const canonicalRoot = fs.realpathSync(repoRoot);
  const canonical = fs.realpathSync(absolute);
  if (!isWithin(canonicalRoot, canonical)) throw new Error(`Override path resolves outside the project: "${relative}".`);
  return absolute;
}

function overlayPath(repoRoot, relative, options = {}) {
  return containedPath(repoRoot, `${PROJECT_OVERRIDE_DIR}/${relative}`, options);
}

function warn(warningSink, file, error) {
  warningSink(`Project override ${file} ignored: ${error.message}`);
}

function readOptionalJson(repoRoot, file, warningSink) {
  try {
    const absolute = overlayPath(repoRoot, file, { type: 'file' });
    if (!absolute) return { present: false, value: null, path: null };
    const stat = fs.statSync(absolute);
    if (stat.size > MAX_JSON_BYTES) throw new Error(`file exceeds ${MAX_JSON_BYTES} bytes`);
    return { present: true, value: JSON.parse(fs.readFileSync(absolute, 'utf8')), path: absolute };
  } catch (error) {
    warn(warningSink, file, error);
    return { present: true, value: null, path: null };
  }
}

function validateBrand(value, repoRoot) {
  assertKeys(value, ['name', 'logo'], 'brand.json');
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 80 || containsControlCharacter(value.name)) {
    throw new Error('brand.json "name" must be 1–80 printable characters.');
  }
  if (value.logo !== undefined && value.logo !== null) {
    if (typeof value.logo !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]*\.(?:svg|png|jpe?g|webp|avif)$/i.test(value.logo)
      || value.logo.split('/').some((part) => !part || part === '.' || part === '..')) {
      throw new Error('brand.json "logo" must be a local image path under public/, such as "customer/brand.svg".');
    }
    const asset = containedPath(repoRoot, `public/${value.logo}`, { mustExist: true, type: 'file' });
    return { name: value.name.trim(), logo: value.logo, logoPath: asset };
  }
  return { name: value.name.trim(), logo: null, logoPath: null };
}

function isSafeTokenValue(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 160
    && /^[A-Za-z0-9#.,%()+*/ _'-]+$/.test(value.trim())
    && !/(?:url|var|expression|javascript)\s*\(|@import/i.test(value)
    && !/[{};<>\\]/.test(value);
}

function validateTheme(value) {
  assertKeys(value, ['themes'], 'theme.json');
  if (!isPlainObject(value.themes) || !Object.keys(value.themes).length) throw new Error('theme.json "themes" must be a non-empty object.');
  const themes = {};
  for (const [name, variants] of Object.entries(value.themes)) {
    if (!SUPPORTED_THEMES.has(name)) throw new Error(`theme.json uses unsupported theme "${name}"; supported themes: ${[...SUPPORTED_THEMES].join(', ')}.`);
    assertKeys(variants, ['light', 'dark'], `theme.json themes.${name}`);
    const normalized = {};
    for (const scheme of ['light', 'dark']) {
      if (variants[scheme] === undefined) continue;
      if (!isPlainObject(variants[scheme]) || !Object.keys(variants[scheme]).length) throw new Error(`theme.json themes.${name}.${scheme} must contain at least one token.`);
      const tokens = {};
      for (const [token, tokenValue] of Object.entries(variants[scheme])) {
        if (!PUBLIC_TOKENS.has(token)) throw new Error(`theme.json token "${token}" is not part of the public semantic token API.`);
        if (!isSafeTokenValue(tokenValue)) throw new Error(`theme.json token "${token}" has an unsafe or invalid CSS value.`);
        tokens[token] = tokenValue.trim();
      }
      normalized[scheme] = tokens;
    }
    if (!Object.keys(normalized).length) throw new Error(`theme.json themes.${name} must define light and/or dark tokens.`);
    themes[name] = normalized;
  }
  return themes;
}

function validateExternalNavigation(value) {
  if (!Array.isArray(value)) throw new Error('navigation.json "external" must be an array.');
  const seen = new Set();
  return value.map((item, index) => {
    assertKeys(item, ['id', 'label', 'href'], `navigation.json external[${index}]`);
    if (typeof item.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(item.id)) throw new Error(`navigation.json external[${index}].id is invalid.`);
    if (seen.has(item.id)) throw new Error(`navigation.json external contains duplicate id "${item.id}".`);
    seen.add(item.id);
    if (typeof item.label !== 'string' || !item.label.trim() || item.label.length > 60 || containsControlCharacter(item.label)) throw new Error(`navigation.json external[${index}].label is invalid.`);
    let url;
    try { url = new URL(item.href); } catch { throw new Error(`navigation.json external[${index}].href must be an absolute HTTPS URL.`); }
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error(`navigation.json external[${index}].href must use HTTPS and cannot contain credentials or a fragment.`);
    return { id: item.id, label: item.label.trim(), href: url.href };
  });
}

function validateNavigation(value) {
  assertKeys(value, ['items', 'external'], 'navigation.json');
  if (value.items !== undefined && !Array.isArray(value.items)) throw new Error('navigation.json "items" must be an array.');
  const ids = new Set();
  const items = (value.items || []).map((item, index) => {
    assertKeys(item, ['pageId', 'label', 'groups', 'order', 'hidden'], `navigation.json items[${index}]`);
    if (typeof item.pageId !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/i.test(item.pageId)) throw new Error(`navigation.json items[${index}].pageId is invalid.`);
    if (ids.has(item.pageId)) throw new Error(`navigation.json contains duplicate pageId "${item.pageId}".`);
    ids.add(item.pageId);
    const normalized = { pageId: item.pageId };
    if (item.label !== undefined) {
      if (typeof item.label !== 'string' || !item.label.trim() || item.label.length > 60 || containsControlCharacter(item.label)) throw new Error(`navigation.json items[${index}].label is invalid.`);
      normalized.label = item.label.trim();
    }
    if (item.groups !== undefined) {
      if (!Array.isArray(item.groups) || item.groups.some((group) => !['main', 'footer', 'blueprint'].includes(group))) throw new Error(`navigation.json items[${index}].groups must contain only main, footer, or blueprint.`);
      normalized.groups = [...new Set(item.groups)];
    }
    if (item.order !== undefined) {
      if (!Number.isSafeInteger(item.order) || item.order < -1000 || item.order > 1000) throw new Error(`navigation.json items[${index}].order must be an integer from -1000 to 1000.`);
      normalized.order = item.order;
    }
    if (item.hidden !== undefined) {
      if (typeof item.hidden !== 'boolean') throw new Error(`navigation.json items[${index}].hidden must be a boolean.`);
      normalized.hidden = item.hidden;
    }
    return normalized;
  });
  const external = value.external === undefined ? null : validateExternalNavigation(value.external);
  if (value.items === undefined && external === null) throw new Error('navigation.json must define "items" and/or "external".');
  return { items, external };
}

function cssForTokens(themes) {
  const blocks = [];
  for (const [theme, variants] of Object.entries(themes)) {
    if (variants.light) {
      const declarations = Object.entries(variants.light).map(([key, value]) => `  ${key}: ${value};`).join('\n');
      blocks.push(`html[data-theme="${theme}"] {\n${declarations}\n}`);
    }
    if (variants.dark) {
      const declarations = Object.entries(variants.dark).map(([key, value]) => `  ${key}: ${value};`).join('\n');
      blocks.push(`html[data-theme="${theme}"][data-color-scheme="dark"] {\n${declarations}\n}`);
    }
  }
  return blocks.length ? `${blocks.join('\n\n')}\n` : '';
}

function writeGenerated(generatedRoot, name, contents) {
  const dir = path.resolve(generatedRoot, GENERATED_OVERRIDE_DIR);
  const file = path.join(dir, name);
  if (!contents) {
    try { fs.unlinkSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return null;
  }
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === contents) return file;
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, contents, { mode: 0o600 });
  fs.renameSync(temporary, file);
  return file;
}

function sassString(value) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function loadCustomScss(repoRoot, warningSink) {
  try {
    const file = overlayPath(repoRoot, 'custom.scss', { type: 'file' });
    if (!file) return null;
    if (fs.statSync(file).size > MAX_SCSS_BYTES) throw new Error(`file exceeds ${MAX_SCSS_BYTES} bytes`);
    sass.compile(file, { loadPaths: [path.dirname(file)], quietDeps: true });
    return file;
  } catch (error) {
    warn(warningSink, 'custom.scss', error);
    return null;
  }
}

function safeOverridePagePath(repoRoot, relative, label) {
  if (typeof relative !== 'string' || !relative.startsWith(`${PROJECT_OVERRIDE_DIR}/pages/`)) {
    throw new Error(`${label} must stay under ${PROJECT_OVERRIDE_DIR}/pages/.`);
  }
  return containedPath(repoRoot, relative, { mustExist: true, type: 'file' });
}

function readOverridePages(repoRoot, demoId, warningSink) {
  let pagesRoot;
  try { pagesRoot = overlayPath(repoRoot, 'pages', { type: 'directory' }); } catch (error) {
    warn(warningSink, 'pages/', error);
    return [];
  }
  if (!pagesRoot) return [];
  const records = [];
  const visit = (directory) => {
    for (const item of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, item.name);
      if (item.isSymbolicLink()) {
        warn(warningSink, path.relative(repoRoot, absolute), new Error('symbolic links are not allowed'));
        continue;
      }
      if (item.isDirectory()) visit(absolute);
      else if (item.isFile() && item.name === 'page.json') {
        try {
          if (fs.statSync(absolute).size > MAX_JSON_BYTES) throw new Error(`file exceeds ${MAX_JSON_BYTES} bytes`);
          const record = JSON.parse(fs.readFileSync(absolute, 'utf8'));
          if (!isPlainObject(record)) throw new Error('page.json must contain an object');
          if (record.demoId !== undefined && record.demoId !== demoId) throw new Error(`demoId must match the selected demo "${demoId}"`);
          if (!record.demoId) record.demoId = demoId;
          if (record.demoHome || record.route === '/' || record.route === '/404/' || record.id === 'system.404') {
            throw new Error('project pages cannot replace a package home or the system 404 page');
          }
          if (record.collection || record.translationKey || record.translationLocales || record.requiredByDemos) {
            throw new Error('project pages cannot define generated collections or cross-profile translation groups');
          }
          safeOverridePagePath(repoRoot, record.source, 'page source');
          for (const relative of [...(Array.isArray(record.styles) ? record.styles : []), ...(record.script ? [record.script] : []), ...(record.data ? [record.data] : [])]) {
            safeOverridePagePath(repoRoot, relative, 'page asset/data path');
          }
          if (records.length >= MAX_OVERRIDE_PAGES) throw new Error(`project override page count exceeds ${MAX_OVERRIDE_PAGES}`);
          record._manifestFile = path.relative(repoRoot, absolute).split(path.sep).join('/');
          records.push(record);
        } catch (error) {
          warn(warningSink, path.relative(repoRoot, absolute), error);
        }
      }
    }
  };
  try { visit(pagesRoot); } catch (error) { warn(warningSink, 'pages/', error); }
  return records;
}

function loadProjectOverrides({ repoRoot, demoId = 'saas', warningSink = (message) => process.stderr.write(`${message}\n`) } = {}) {
  const root = path.resolve(repoRoot || path.resolve(__dirname, '../..'));
  const overridesRoot = path.resolve(root, PROJECT_OVERRIDE_DIR);
  const brandDefaults = { name: DEFAULT_BRANDS[demoId] || 'Interface Kit', logo: null, logoPath: null };
  const brandRecord = readOptionalJson(root, 'brand.json', warningSink);
  let brand = brandDefaults;
  if (brandRecord.present && brandRecord.value !== null) {
    try { brand = validateBrand(brandRecord.value, root); } catch (error) { warn(warningSink, 'brand.json', error); }
  }

  const themeRecord = readOptionalJson(root, 'theme.json', warningSink);
  let themes = {};
  if (themeRecord.present && themeRecord.value !== null) {
    try { themes = validateTheme(themeRecord.value); } catch (error) { warn(warningSink, 'theme.json', error); }
  }

  const navigationRecord = readOptionalJson(root, 'navigation.json', warningSink);
  let navigation = { items: [], external: null };
  if (navigationRecord.present && navigationRecord.value !== null) {
    try { navigation = validateNavigation(navigationRecord.value); } catch (error) { warn(warningSink, 'navigation.json', error); }
  }

  const pageRecords = readOverridePages(root, demoId, warningSink);
  let customScssSource = loadCustomScss(root, warningSink);
  const tokensScssPath = writeGenerated(root, 'tokens.scss', cssForTokens(themes));
  let customScssPath = null;
  if (customScssSource) {
    const source = `@use ${sassString(customScssSource.split(path.sep).join('/'))} as *;\n`;
    customScssPath = writeGenerated(root, 'custom.scss', source);
    if (customScssPath) {
      try { sass.compile(customScssPath, { loadPaths: [overridesRoot], quietDeps: true }); }
      catch (error) {
        warn(warningSink, 'custom.scss', error);
        writeGenerated(root, 'custom.scss', '');
        customScssPath = null;
      }
    }
  } else {
    writeGenerated(root, 'custom.scss', '');
  }

  const watchFiles = [brandRecord.path, themeRecord.path, navigationRecord.path, customScssSource].filter(Boolean);
  const watchRoots = [overridesRoot, path.join(overridesRoot, 'pages')];
  return Object.freeze({
    brand: Object.freeze(brand),
    themes: Object.freeze(themes),
    navigation: Object.freeze(navigation),
    pageRecords: Object.freeze(pageRecords),
    customScssSource,
    tokensScssPath,
    customScssPath,
    overrideRoot: overridesRoot,
    watchFiles: Object.freeze(watchFiles),
    watchRoots: Object.freeze(watchRoots),
    defaultExternalNavigation: DEFAULT_EXTERNAL_NAVIGATION,
  });
}

module.exports = {
  PROJECT_OVERRIDE_DIR,
  GENERATED_OVERRIDE_DIR,
  PUBLIC_TOKENS,
  DEFAULT_EXTERNAL_NAVIGATION,
  DEFAULT_BRANDS,
  containedPath,
  validateBrand,
  validateTheme,
  validateNavigation,
  cssForTokens,
  loadProjectOverrides,
};
