#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const script = path.resolve(__dirname, "../../scripts/package-release.cjs");

function run(args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
}

const output = fs.mkdtempSync(path.join(os.tmpdir(), "release-cli-check-"));
try {
  const preserved = path.join(output, "existing.zip");
  fs.writeFileSync(preserved, "keep existing release\n");
  const common = ["--demo", "saas", "--site-url", "https://example.test", "--build-now", "2026-10-03T12:00:00.000Z", "--out", preserved];

  const badDemo = run(["--demo", "unknown", ...common.slice(2)]);
  assert.notEqual(badDemo.status, 0);
  assert.match(badDemo.stderr, /--demo must be saas or agency/);

  const badBase = run([...common.slice(0, -2), "--base-path", "/../escape/", "--out", path.join(output, "bad-base.zip")]);
  assert.notEqual(badBase.status, 0);
  assert.match(badBase.stderr, /canonical root-relative/);

  const missingOffset = run(["--demo", "saas", "--site-url", "https://example.test", "--build-now", "2026-10-03", "--out", path.join(output, "bad-time.zip")]);
  assert.notEqual(missingOffset.status, 0);
  assert.match(missingOffset.stderr, /ISO-8601 timestamp with seconds and an explicit UTC offset/);

  const noOverwrite = run(common);
  assert.notEqual(noOverwrite.status, 0);
  assert.match(noOverwrite.stderr, /Refusing to overwrite existing output/);
  assert.equal(fs.readFileSync(preserved, "utf8"), "keep existing release\n");

  const help = run(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--build-now/);
  process.stdout.write("Release CLI checks passed: help, invalid demo/base path, explicit timestamp contract, and existing-output refusal.\n");
} finally {
  fs.rmSync(output, { recursive: true, force: true });
}
