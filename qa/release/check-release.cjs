#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { verifyExtractedPreview } = require("./preview-http.cjs");

const repoRoot = path.resolve(__dirname, "../..");
const fixedBuildNow = "2026-10-03T12:00:00.000Z";
const siteUrl = "https://release.example.test";

function run(script, args) {
  process.stdout.write(`Release acceptance step: ${script}\n`);
  const result = spawnSync(process.execPath, [path.join(repoRoot, script), ...args], { cwd: repoRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} exited ${result.status}.\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

function hash(buffer) { return crypto.createHash("sha256").update(buffer).digest("hex"); }

function measurementSummary(label, packageRoot) {
  const release = JSON.parse(fs.readFileSync(path.join(packageRoot, "release-manifest.json"), "utf8"));
  const report = JSON.parse(fs.readFileSync(path.join(packageRoot, "PERFORMANCE-MEASUREMENTS.json"), "utf8"));
  const amount = (type) => `${report.aggregate[type].rawBytes}/${report.aggregate[type].gzipBytes}`;
  const raster = report.largestRaster ? `${report.largestRaster.path} (${report.largestRaster.rawBytes} B)` : "none (all emitted images are SVG)";
  return `${label}: ${release.html.pageCount} routes; HTML raw/gzip=${amount("html")} B, CSS=${amount("css")} B, JS=${amount("js")} B, fonts=${amount("font")} B, images=${amount("image")} B; largest raster=${raster}; budget failures=${report.failures.length}.`;
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "theme-release-acceptance-"));
  try {
    process.stdout.write(run("qa/release/test-preview-http.cjs", []));
    const rootArchive = path.join(tempRoot, "saas-root.zip");
    const repeatArchive = path.join(tempRoot, "saas-root-repeat.zip");
    const subpathArchive = path.join(tempRoot, "saas-subpath.zip");
    const agencyArchive = path.join(tempRoot, "agency-root.zip");
    const rootExtract = path.join(tempRoot, "root-extracted");
    const subpathExtract = path.join(tempRoot, "subpath-extracted");
    const agencyExtract = path.join(tempRoot, "agency-extracted");
    const common = ["--demo", "saas", "--site-url", siteUrl, "--build-now", fixedBuildNow, "--root", repoRoot];
    run("qa/release/test-scaffolds.cjs", []);
    run("qa/release/test-release-cli.cjs", []);
    run("qa/release/rehearse-upgrade.cjs", []);
    run("scripts/package-release.cjs", [...common, "--base-path", "/", "--out", rootArchive]);
    run("scripts/package-release.cjs", [...common, "--base-path", "/", "--out", repeatArchive]);
    const firstBytes = fs.readFileSync(rootArchive);
    const secondBytes = fs.readFileSync(repeatArchive);
    assert.deepEqual(secondBytes, firstBytes, "same inputs must make byte-identical release archives");
    run("qa/release/smoke-extracted.cjs", [rootArchive, "--extract-to", rootExtract]);
    run("qa/release/check-csp.cjs", [rootExtract]);
    process.stdout.write("Release acceptance step: HTTP smoke for extracted SaaS root\n");
    const rootHttp = await verifyExtractedPreview({ packageRoot: rootExtract, label: "SaaS root", requireJavaScript: true });

    const subpath = "/preview/theme/";
    run("scripts/package-release.cjs", [...common, "--base-path", subpath, "--out", subpathArchive]);
    run("qa/release/smoke-extracted.cjs", [subpathArchive, "--extract-to", subpathExtract]);
    run("qa/release/check-csp.cjs", [subpathExtract]);
    process.stdout.write("Release acceptance step: HTTP smoke for extracted SaaS subpath\n");
    const subpathHttp = await verifyExtractedPreview({ packageRoot: subpathExtract, label: "SaaS subpath", requireJavaScript: true });
    run("scripts/package-release.cjs", ["--demo", "agency", "--site-url", siteUrl, "--build-now", fixedBuildNow, "--root", repoRoot, "--base-path", "/", "--out", agencyArchive]);
    run("qa/release/smoke-extracted.cjs", [agencyArchive, "--extract-to", agencyExtract]);
    run("qa/release/check-csp.cjs", [agencyExtract]);
    process.stdout.write("Release acceptance step: HTTP smoke for extracted Agency root\n");
    const agencyHttp = await verifyExtractedPreview({ packageRoot: agencyExtract, label: "Agency root" });
    const digest = hash(firstBytes);
    process.stdout.write(`Release acceptance passed: scaffolds, upgrade fixture, and deterministic SaaS archive SHA-256 ${digest}; extracted SaaS root/subpath and Agency root bundles passed link, assets, checksum, license, CSP, metadata, and budget checks.\n`);
    for (const [label, result] of [["SaaS root", rootHttp], ["SaaS subpath", subpathHttp], ["Agency root", agencyHttp]]) {
      process.stdout.write(`HTTP preview smoke passed for ${label} (${result.basePath}): ${result.htmlPages} HTML routes, ${result.css} CSS, ${result.js} JS, ${result.fonts} fonts; unknown route and asset returned 404 without SPA fallback.\n`);
    }
    process.stdout.write(`${measurementSummary("SaaS root", rootExtract)}\n`);
    process.stdout.write(`${measurementSummary("SaaS subpath", subpathExtract)}\n`);
    process.stdout.write(`${measurementSummary("Agency root", agencyExtract)}\n`);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`check-release: ${error.stack || error}\n`);
    process.exitCode = 1;
  });
}
