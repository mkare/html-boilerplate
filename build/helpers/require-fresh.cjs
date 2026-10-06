const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '../..');
const EXCLUDED_REPO_SEGMENTS = new Set(['.generated', '.git', 'dist', 'node_modules']);

function isRefreshableRepoModule(filename) {
  const relative = path.relative(REPO_ROOT, path.resolve(filename));
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return false;
  return !relative.split(path.sep).some((segment) => EXCLUDED_REPO_SEGMENTS.has(segment));
}

function invalidateModuleTree(modulePath) {
  const entry = require.resolve(modulePath);
  const visited = new Set();

  function invalidate(filename, force = false) {
    const resolved = path.resolve(filename);
    if (visited.has(resolved)) return;
    const cached = require.cache[resolved];
    if (!cached || (!force && !isRefreshableRepoModule(resolved))) return;
    visited.add(resolved);

    for (const child of cached.children) invalidate(child.filename);
    delete require.cache[resolved];
  }

  invalidate(entry, true);
  return entry;
}

function requireFresh(modulePath) {
  return require(invalidateModuleTree(modulePath));
}

module.exports = { invalidateModuleTree, requireFresh };
