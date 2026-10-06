const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const buildNow = '2026-10-03T12:00:00.000Z';

function filesUnder(directory, result = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) filesUnder(absolute, result);
    else if (entry.isFile()) result.push(absolute);
  }
  return result.sort((a, b) => path.relative(directory, a).localeCompare(path.relative(directory, b)));
}

function digestTree() {
  const hash = crypto.createHash('sha256');
  const files = filesUnder(dist);
  for (const file of files) {
    const relative = path.relative(dist, file).split(path.sep).join('/');
    hash.update(relative);
    hash.update('\0');
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  return { checksum: hash.digest('hex'), fileCount: files.length };
}

function buildOnce() {
  const result = spawnSync('yarn', ['build'], {
    cwd: root,
    env: { ...process.env, BUILD_NOW: buildNow },
    encoding: 'utf8',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error('yarn build exited with status ' + result.status + '.');
  return digestTree();
}

try {
  const first = buildOnce();
  const second = buildOnce();
  if (first.checksum !== second.checksum || first.fileCount !== second.fileCount) {
    process.stderr.write('Reproducibility failed: first=' + JSON.stringify(first) + ', second=' + JSON.stringify(second) + '\n');
    process.exitCode = 1;
  } else {
    process.stdout.write('reproducible build passed: ' + first.fileCount + ' files, SHA-256 ' + first.checksum + ', BUILD_NOW ' + buildNow + '.\n');
  }
} catch (error) {
  process.stderr.write((error.stack || error) + '\n');
  process.exitCode = 1;
}
