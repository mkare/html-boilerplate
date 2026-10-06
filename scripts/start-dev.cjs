const fs = require('node:fs');
const path = require('node:path');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const { createWebpackConfig, validateWebpackInputs } = require('../webpack.config.js');

const sourceRoot = path.resolve(__dirname, '../src');
const projectRoot = path.resolve(__dirname, '../project');
const overrideRoot = path.join(projectRoot, 'overrides');
const watchers = [];
let server;
let restartTimer;
let restarting = false;
let pendingRestart = false;

async function startServer(config = createWebpackConfig({}, { mode: 'development' })) {
  const compiler = webpack(config);
  server = new WebpackDevServer(config.devServer, compiler);
  await server.start();
  process.stdout.write('Development server ready. Page manifests, project overrides, page data, and content data edits restart the build.\n');
}

async function restartServer() {
  if (restarting) {
    pendingRestart = true;
    return;
  }
  restarting = true;
  process.stdout.write('Page manifest, project override, or page/content data changed; rebuilding the manifest and restarting Webpack.\n');
  const previous = server;
  try {
    // Validate changed inputs before stopping the active server. Constructing a
    // second PugPlugin before the old compiler stops mutates the plugin's shared
    // static options and can break an in-flight HTML render.
    validateWebpackInputs({}, { mode: 'development' });
    server = undefined;
    if (previous) await previous.stop();
    const nextConfig = createWebpackConfig({}, { mode: 'development' });
    await startServer(nextConfig);
  } catch (error) {
    process.stderr.write(`${error.stack || error}\n`);
  } finally {
    restarting = false;
    if (pendingRestart) {
      pendingRestart = false;
      restartServer();
    }
  }
}

function shouldRestart(filename) {
  if (!filename) return false;
  const normalized = filename.toString().split(path.sep).join('/');
  return /(^|\/)page\.json$/i.test(normalized)
    || /(^|\/)src\/pages\/.*\.(?:json|cjs)$/i.test(normalized)
    || /^pages\/.*\.(?:json|cjs)$/i.test(normalized)
    || /^content\/.*\.(?:json|cjs)$/i.test(normalized);
}

async function close() {
  clearTimeout(restartTimer);
  for (const watcher of watchers) watcher.close();
  try { if (server) await server.stop(); } catch { /* process is already stopping */ }
  process.exit(0);
}

async function main() {
  await startServer();
  try {
    const queueRestart = () => {
      clearTimeout(restartTimer);
      restartTimer = setTimeout(restartServer, 180);
    };
    watchers.push(fs.watch(sourceRoot, { recursive: true }, (_event, filename) => {
      if (!shouldRestart(filename)) return;
      queueRestart();
    }));
  } catch (error) {
    process.stderr.write(`Could not watch page manifests automatically (${error.message}); restart npm start after adding or removing a page.json.\n`);
  }
  try {
    // Keep a real directory watch so adding a previously absent brand/theme/menu
    // file, repairing malformed JSON, or adding/removing a custom page is observed.
    fs.mkdirSync(overrideRoot, { recursive: true });
    watchers.push(fs.watch(projectRoot, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      const relative = filename.toString().split(path.sep).join('/');
      if (!/^overrides(?:\/|$)/i.test(relative)) return;
      clearTimeout(restartTimer);
      restartTimer = setTimeout(restartServer, 180);
    }));
  } catch (error) {
    process.stderr.write(`Could not watch project overrides automatically (${error.message}); restart the development server after changing project/overrides.\n`);
  }
}

process.on('SIGINT', close);
process.on('SIGTERM', close);
main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
