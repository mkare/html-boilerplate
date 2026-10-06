const path = require('node:path');

function normalizeBasePath(value = '/') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    throw new Error(`BASE_PATH must be a root-relative path such as "/" or "/preview/theme/"; received "${value}".`);
  }
  let decoded;
  try { decoded = decodeURIComponent(value); } catch { decoded = null; }
  if (!decoded || /[?#\\\s]/.test(value) || value.includes('//') || decoded.includes('//') || decoded.split('/').some((part) => part === '.' || part === '..')) {
    throw new Error(`BASE_PATH contains an invalid path segment: "${value}".`);
  }
  const trimmed = value.replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
}

function normalizeAssetBase(value = '/') {
  if (typeof value !== 'string' || !value.trim()) throw new Error('ASSET_BASE must be a path or an absolute HTTP(S) URL.');
  const input = value.trim();
  if (/^https?:\/\//i.test(input)) {
    const url = new URL(input);
    if (url.search || url.hash || url.username || url.password) throw new Error('ASSET_BASE cannot contain credentials, a query, or a fragment.');
    return `${url.origin}${url.pathname.replace(/\/{2,}/g, '/').replace(/\/*$/, '/')}`;
  }
  return normalizeBasePath(input);
}

function normalizeSiteUrl(value = '') {
  if (value === '') return null;
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('SITE_URL must be an absolute HTTP(S) origin without credentials, path, query, or fragment.');
  }
  return url.origin;
}

function createRouteHelper(pages, site) {
  const routeById = new Map(pages.map((page) => [page.id, page.route]));
  const idByRoute = new Map(pages.map((page) => [page.route, page.id]));

  return function route(idOrCanonicalRoute, params = {}) {
    if (typeof idOrCanonicalRoute !== 'string') throw new TypeError('route() expects a page id or canonical route string.');
    let routePath = routeById.get(idOrCanonicalRoute);
    if (!routePath && idByRoute.has(idOrCanonicalRoute)) routePath = idOrCanonicalRoute;
    if (!routePath) throw new Error(`route(): unknown page id or route "${idOrCanonicalRoute}".`);
    if (!params || typeof params !== 'object' || Array.isArray(params)) throw new TypeError('route() params must be an object.');

    const used = new Set();
    routePath = routePath.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, (token, name) => {
      if (!(name in params)) throw new Error(`route(): missing parameter "${name}" for ${idOrCanonicalRoute}.`);
      used.add(name);
      return encodeURIComponent(String(params[name]));
    });
    const unused = Object.keys(params).filter((name) => !used.has(name));
    if (unused.length) throw new Error(`route(): unused parameter(s) for ${idOrCanonicalRoute}: ${unused.join(', ')}.`);
    return `${site.basePath.replace(/\/$/, '')}${routePath === '/' ? '/' : routePath}`;
  };
}

function createAssetUrlHelper(site) {
  return function assetUrl(assetPath) {
    if (typeof assetPath !== 'string' || !assetPath.trim()) throw new TypeError('assetUrl() expects a non-empty asset path.');
    const value = assetPath.trim();
    if (/^(?:https?:)?\/\//i.test(value)) return value;
    if (/[?#\\\s]/.test(value)) throw new Error(`assetUrl(): invalid asset path "${assetPath}".`);
    const clean = value.replace(/^\/+/, '');
    if (!clean || clean.split('/').some((part) => part === '.' || part === '..')) throw new Error(`assetUrl(): invalid asset path "${assetPath}".`);
    return `${site.assetBase.replace(/\/$/, '')}/${clean}`;
  };
}

function safeRepoPath(repoRoot, value, owner) {
  if (typeof value !== 'string' || !value.trim() || path.isAbsolute(value) || value.includes('\\')) {
    throw new Error(`${owner} must be a repository-relative path; received "${value}".`);
  }
  if (value.split('/').some((part) => part === '.' || part === '..' || part === '')) {
    throw new Error(`${owner} must not contain empty, current-directory, or parent-directory segments: "${value}".`);
  }
  const resolved = path.resolve(repoRoot, value);
  const relative = path.relative(repoRoot, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${owner} escapes the repository: "${value}".`);
  }
  return resolved;
}

module.exports = {
  normalizeBasePath,
  normalizeAssetBase,
  normalizeSiteUrl,
  createRouteHelper,
  createAssetUrlHelper,
  safeRepoPath,
};
