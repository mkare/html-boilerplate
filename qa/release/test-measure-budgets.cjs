#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { measure, toMarkdown } = require("./measure-budgets.cjs");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "framework-budget-reuse-"));
function write(relative, content) {
  const destination = path.join(root, ...relative.split("/"));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
}

try {
  write("index.html", '<!doctype html><html><head><link rel="stylesheet" href="/assets/core.css"><link rel="stylesheet" href="/assets/home.css"><script src="/assets/runtime.js"></script><script src="/assets/home.js"></script></head><body></body></html>');
  write("about/index.html", '<!doctype html><html><head><link rel="stylesheet" href="/assets/core.css"><link rel="stylesheet" href="/assets/about.css"><script src="/assets/runtime.js"></script><script src="/assets/about.js"></script></head><body></body></html>');
  write("assets/core.css", "html{color:#111}");
  write("assets/home.css", ".home{display:block}");
  write("assets/about.css", ".about{display:block}");
  write("assets/orphan.css", ".orphan{display:none}");
  write("assets/runtime.js", "globalThis.runtimeMounts=(globalThis.runtimeMounts||0)+1;");
  write("assets/home.js", "globalThis.pageReady=true;");
  write("assets/about.js", "globalThis.pageReady=true;");

  const manifest = {
    buildNow: "2026-10-03T12:00:00.000Z",
    profile: "fixture",
    selectedDemo: "fixture",
    site: { basePath: "/", siteUrl: "" },
    pages: [
      { id: "home", route: "/", output: "index.html" },
      { id: "about", route: "/about/", output: "about/index.html" },
    ],
  };
  const report = measure(root, manifest);
  assert.equal(report.assetReuse.css.sharedAssets.find((asset) => asset.path === "assets/core.css")?.pageCount, 2);
  assert.equal(report.assetReuse.js.sharedAssets.find((asset) => asset.path === "assets/runtime.js")?.pageCount, 2);
  assert.ok(report.assetReuse.css.repeatedReferenceRawBytes > 0);
  assert.ok(report.assetReuse.js.repeatedReferenceGzipBytes > 0);
  const duplicate = report.byteIdenticalAssets.find((asset) => asset.paths.includes("assets/home.js"));
  assert.deepEqual(duplicate.paths, ["assets/about.js", "assets/home.js"]);
  assert.equal(duplicate.duplicateRawBytes, duplicate.rawBytes);
  assert.deepEqual(report.unusedCss, ["assets/orphan.css"]);
  assert.ok(report.failures.some((failure) => failure.includes("Unreferenced CSS assets")));
  assert.equal(report.unusedJs.length, 0);

  const baseline = {
    pages: Object.fromEntries(Object.entries(report.pages).map(([id, page]) => [id, {
      cssGzipBytes: page.cssGzipBytes,
      jsGzipBytes: page.jsGzipBytes,
    }])),
  };
  const baselineReport = measure(root, manifest, { baseline });
  assert.equal(baselineReport.pages.home.baseline.cssGzipBytes.deltaBytes, 0);
  assert.equal(baselineReport.pages.home.baseline.cssGzipBytes.percentChange, 0);
  assert.equal(baselineReport.pages.about.baseline.jsGzipBytes.passed, true);

  const regressedBaseline = { pages: { home: { cssGzipBytes: 1, jsGzipBytes: 1 } } };
  const regressed = measure(root, manifest, { baseline: regressedBaseline });
  assert.equal(regressed.pages.home.baseline.cssGzipBytes.passed, false);
  assert.ok(regressed.pages.home.baseline.cssGzipBytes.percentChange > 0);
  assert.ok(regressed.failures.some((failure) => failure.includes("home cssGzipBytes regressed")));

  const markdown = toMarkdown(report);
  assert.match(markdown, /Shared asset reuse and repeated page references/);
  assert.match(markdown, /Byte-identical distinct emitted CSS\/JS files/);
  assert.match(markdown, /browsers can reuse identical URL responses from cache/);
  assert.match(toMarkdown(baselineReport), /CSS vs baseline/);
  process.stdout.write("Release budget reporting fixtures passed: cross-page asset reuse, unused CSS/JS rejection, byte-identical files, and per-page baseline deltas are reported.\n");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
