#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const parse5 = require("parse5");
const { extractZipBuffer, normalizeArchivePath } = require("./archive.cjs");

function fail(message) { throw new Error(message); }

function walk(directory, found = []) {
  if (!fs.existsSync(directory)) return found;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, found);
    else if (entry.isFile()) found.push(absolute);
  }
  return found;
}

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }

function parseHtml(filename) {
  const errors = [];
  const document = parse5.parse(fs.readFileSync(filename, "utf8"), { onParseError: (error) => errors.push(error) });
  if (errors.length) fail(`${path.basename(filename)} has ${errors.length} HTML parse error(s): ${errors[0].code}.`);
  return document;
}

function getAttributes(node) {
  return Object.fromEntries((node.attrs || []).map((attribute) => [attribute.name, attribute.value]));
}

function verifyChecksums(packageRoot, manifest) {
  const checksumFile = path.join(packageRoot, manifest.checksums || "checksums.sha256");
  if (!fs.existsSync(checksumFile)) fail("Checksum inventory is missing.");
  const entries = new Map();
  for (const line of fs.readFileSync(checksumFile, "utf8").split(/\r?\n/).filter(Boolean)) {
    const match = line.match(/^([a-f0-9]{64}) {2}(.+)$/);
    if (!match) fail(`Malformed checksum row: ${line}`);
    const relative = normalizeArchivePath(match[2]);
    if (relative === manifest.checksums) fail("Checksum inventory must not checksum itself.");
    if (entries.has(relative)) fail(`Duplicate checksum for ${relative}.`);
    const filename = path.resolve(packageRoot, ...relative.split("/"));
    if (!filename.startsWith(`${path.resolve(packageRoot)}${path.sep}`) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) fail(`Checksummed file is missing or unsafe: ${relative}`);
    const actual = sha256(fs.readFileSync(filename));
    if (actual !== match[1]) fail(`Checksum mismatch for ${relative}.`);
    entries.set(relative, actual);
  }
  if (!entries.has("release-manifest.json")) fail("Checksum inventory must include release-manifest.json.");
  const packageFiles = walk(packageRoot).map((file) => path.relative(packageRoot, file).split(path.sep).join("/"));
  for (const relative of packageFiles) {
    if (relative === manifest.checksums || relative === "release-manifest.json") continue;
    if (!entries.has(relative)) fail(`File is absent from checksum inventory: ${relative}`);
  }
  return entries.size;
}

function verifyLicenses(packageRoot) {
  const inventoryPath = path.join(packageRoot, "documentation/licenses/inventory.json");
  if (!fs.existsSync(inventoryPath)) fail("Third-party license inventory is missing.");
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
  if (!Array.isArray(inventory.packages) || inventory.packages.length === 0) fail("License inventory has no package records.");
  const unknown = inventory.packages.filter((item) => !item.name || !item.version || !item.license || item.license === "UNKNOWN");
  if (unknown.length) fail(`${unknown.length} third-party package(s) have no declared license.`);
  const missingLicenseFiles = inventory.packages.flatMap((item) => item.licenseFiles || []).filter((relative) => !fs.existsSync(path.join(packageRoot, "documentation/licenses", relative)));
  if (missingLicenseFiles.length) fail(`Third-party license text is missing: ${missingLicenseFiles[0]}`);
  return inventory.packages.length;
}

function localOutputFromUrl(value, page, manifest, htmlRoot) {
  if (!value || /^(?:#|mailto:|tel:|javascript:|data:|blob:)/i.test(value)) return { ignored: true };
  const basePath = manifest.basePath || "/";
  const basePrefix = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  const siteUrl = manifest.siteUrl || "https://release.invalid";
  let parsed;
  try { parsed = new URL(value, `${siteUrl}${basePrefix}${page.route === "/" ? "/" : page.route}`); }
  catch { return { error: `invalid URL ${value}` }; }
  if (!/^https?:$/.test(parsed.protocol)) return { ignored: true };
  if (parsed.origin !== new URL(siteUrl).origin && siteUrl !== "https://release.invalid") return { ignored: true };
  let pathname;
  try { pathname = decodeURIComponent(parsed.pathname); } catch { return { error: `invalid encoded URL ${value}` }; }
  if (basePath !== "/") {
    if (!pathname.startsWith(basePath)) return { error: `internal URL escapes ${basePath}: ${value}` };
    pathname = `/${pathname.slice(basePath.length)}`;
  }
  const targetRoute = pathname === "" ? "/" : pathname.endsWith("/") || path.posix.extname(pathname) ? pathname : `${pathname}/`;
  const route = manifest.pages.find((candidate) => candidate.route === targetRoute);
  if (route) return { route: targetRoute, output: route.output };
  let output = pathname.replace(/^\/+/, "");
  if (!output) output = "index.html";
  const absolute = path.resolve(htmlRoot, ...output.split("/"));
  if (!absolute.startsWith(`${path.resolve(htmlRoot)}${path.sep}`)) return { error: `unsafe local path ${value}` };
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return { error: `local target is missing: ${value}` };
  return { output };
}

function verifyHtmlSite(packageRoot, manifest, siteDirectory = "html", { expectedRobots = null } = {}) {
  const htmlRoot = path.join(packageRoot, siteDirectory);
  const pages = manifest.pages || [];
  const routes = new Map(pages.map((page) => [page.route, page]));
  const htmlFiles = walk(htmlRoot).filter((file) => file.endsWith(".html"));
  if (htmlFiles.length !== pages.length) fail(`${siteDirectory} has ${htmlFiles.length} HTML files; release manifest lists ${pages.length} pages.`);
  const linkedScripts = new Set();
  const inlineScriptHashes = new Set();

  for (const page of pages) {
    const filename = path.join(htmlRoot, ...page.output.split("/"));
    if (!fs.existsSync(filename)) fail(`Page ${page.id} is missing from ${siteDirectory}: ${page.output}`);
    const tree = parseHtml(filename);
    const ids = new Set();
    const duplicateIds = new Set();
    let robotsSeen = false;
    const visit = (node) => {
      if (!node.tagName) {
        for (const child of node.childNodes || []) visit(child);
        if (node.content) visit(node.content);
        return;
      }
      const attributes = getAttributes(node);
      if (attributes.id) {
        if (ids.has(attributes.id)) duplicateIds.add(attributes.id);
        ids.add(attributes.id);
      }
      if (node.tagName === "meta" && (attributes.name || "").toLowerCase() === "robots") {
        robotsSeen = true;
        const actualRobots = (attributes.content || "").toLowerCase().replace(/\s/g, "");
        if (expectedRobots && actualRobots !== expectedRobots) fail(`${page.id} ${siteDirectory} robots metadata is "${actualRobots}"; expected "${expectedRobots}".`);
        if (!expectedRobots) {
          const expected = (page.robots || (page.id === "system.404" ? "noindex,follow" : "")).toLowerCase().replace(/\s/g, "");
          if (actualRobots !== expected) fail(`${page.id} production robots metadata is "${actualRobots}"; expected source metadata "${expected}".`);
        }
      }
      if (node.tagName === "script") {
        if (attributes.src) {
          const local = localOutputFromUrl(attributes.src, page, manifest, htmlRoot);
          if (local.error) fail(`${page.id}: ${local.error}`);
          else if (local.output) linkedScripts.add(local.output);
        } else {
          const content = node.childNodes?.map((child) => child.value || "").join("") || "";
          inlineScriptHashes.add(`'sha256-${crypto.createHash("sha256").update(content).digest("base64")}'`);
        }
      }
      if (node.tagName === "a" && attributes.href?.startsWith("#") && attributes.href.length > 1) {
        let fragment;
        try { fragment = decodeURIComponent(attributes.href.slice(1)); } catch { fail(`${page.id} has invalid fragment ${attributes.href}`); }
        if (fragment && !ids.has(fragment)) {
          // Check after the complete tree walk below.
        }
      }
      for (const attrName of ["href", "src", "poster", "action"]) {
        const value = attributes[attrName];
        if (!value || (node.tagName === "script" && attrName === "src")) continue;
        if (node.tagName === "a" && attrName === "href" && value.startsWith("#")) continue;
        const isLinkResource = node.tagName === "link" && attrName === "href";
        const isAnchor = (node.tagName === "a" || node.tagName === "area" || node.tagName === "form") && (attrName === "href" || attrName === "action");
        if (!isLinkResource && !isAnchor && attrName === "href") continue;
        const local = localOutputFromUrl(value, page, manifest, htmlRoot);
        if (local.error) fail(`${page.id}: ${local.error}`);
        else if (isAnchor && local.route && !routes.has(local.route)) fail(`${page.id} links to an unlisted route ${local.route}.`);
      }
      if (attributes.srcset) {
        for (const candidate of attributes.srcset.split(",")) {
          const value = candidate.trim().split(/\s+/)[0];
          const local = localOutputFromUrl(value, page, manifest, htmlRoot);
          if (local.error) fail(`${page.id}: ${local.error}`);
        }
      }
      for (const child of node.childNodes || []) visit(child);
      if (node.content) visit(node.content);
    };
    visit(tree);
    const expectedPageRobots = expectedRobots || (page.robots || (page.id === "system.404" ? "noindex,follow" : "")).toLowerCase().replace(/\s/g, "");
    if (expectedPageRobots && !robotsSeen) fail(`${page.id} is missing expected robots metadata "${expectedPageRobots}".`);
    if (duplicateIds.size) fail(`${page.id} has duplicate IDs: ${[...duplicateIds].join(", ")}.`);
    const unresolved = [];
    const findFragments = (node) => {
      const attributes = getAttributes(node);
      if (node.tagName === "a" && attributes.href?.startsWith("#") && attributes.href.length > 1) {
        try {
          const fragment = decodeURIComponent(attributes.href.slice(1));
          if (!ids.has(fragment)) unresolved.push(fragment);
        } catch { unresolved.push(attributes.href); }
      }
      for (const child of node.childNodes || []) findFragments(child);
      if (node.content) findFragments(node.content);
    };
    findFragments(tree);
    if (unresolved.length) fail(`${page.id} has unresolved fragments: ${[...new Set(unresolved)].join(", ")}.`);
  }

  const cspPath = path.join(packageRoot, "CSP-HEADER.txt");
  if (siteDirectory === "html") {
    if (!fs.existsSync(cspPath)) fail("CSP-HEADER.txt is missing.");
    else {
      const policy = fs.readFileSync(cspPath, "utf8");
      if (/unsafe-inline/i.test(policy)) fail("CSP profile must not allow unsafe-inline.");
      for (const hash of inlineScriptHashes) if (!policy.includes(hash)) fail(`CSP does not allow first-paint inline script ${hash}.`);
      const htmlAttrs = [];
      for (const page of pages) {
        const tree = parseHtml(path.join(htmlRoot, ...page.output.split("/")));
        const inspect = (node) => {
          const style = node.attrs?.find((attribute) => attribute.name === "style");
          if (style) htmlAttrs.push(style.value);
          for (const child of node.childNodes || []) inspect(child);
          if (node.content) inspect(node.content);
        };
        inspect(tree);
      }
      for (const value of htmlAttrs) {
        const hash = `'sha256-${crypto.createHash("sha256").update(value).digest("base64")}'`;
        if (!policy.includes(hash)) fail(`CSP does not allow a required inline style hash ${hash}.`);
      }
    }
  }

  for (const asset of linkedScripts) {
    const filename = path.join(htmlRoot, ...asset.split("/"));
    if (!fs.existsSync(filename)) fail(`JavaScript asset is missing: ${asset}`);
  }
  const basePath = manifest.basePath || "/";
  const basePrefix = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  const siteOrigin = manifest.siteUrl ? new URL(manifest.siteUrl).origin : "https://release.invalid";
  for (const cssFile of walk(htmlRoot).filter((file) => file.endsWith(".css"))) {
    const relative = path.relative(htmlRoot, cssFile).split(path.sep).join("/");
    const cssUrl = `${siteOrigin}${basePrefix}/${relative}`;
    const css = fs.readFileSync(cssFile, "utf8");
    const urlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi;
    let match;
    while ((match = urlPattern.exec(css))) {
      const value = (match[1] ?? match[2] ?? match[3] ?? "").trim();
      if (!value || /^(?:data:|blob:|#)/i.test(value)) continue;
      let parsed;
      try { parsed = new URL(value, cssUrl); } catch { fail(`CSS ${relative} contains an invalid URL: ${value}`); continue; }
      if (!/^https?:$/.test(parsed.protocol) || parsed.origin !== siteOrigin) continue;
      let pathname;
      try { pathname = decodeURIComponent(parsed.pathname); } catch { fail(`CSS ${relative} contains invalid encoded URL: ${value}`); continue; }
      if (basePath !== "/") {
        if (!pathname.startsWith(basePath)) { fail(`CSS ${relative} URL escapes ${basePath}: ${value}`); continue; }
        pathname = `/${pathname.slice(basePath.length)}`;
      }
      const assetPath = pathname.replace(/^\/+/, "");
      const assetFile = path.resolve(htmlRoot, ...assetPath.split("/"));
      if (!assetFile.startsWith(`${path.resolve(htmlRoot)}${path.sep}`) || !fs.existsSync(assetFile)) fail(`CSS ${relative} asset is missing or unsafe: ${value}`);
    }
  }
  return { htmlFiles: htmlFiles.length, inlineScriptHashes: [...inlineScriptHashes], linkedScripts: linkedScripts.size };
}

function verifyPackage(packageRoot) {
  const manifestFile = path.join(packageRoot, "release-manifest.json");
  if (!fs.existsSync(manifestFile)) fail("release-manifest.json is missing.");
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  if (manifest.profile !== "release-html") fail(`Expected release-html package; received ${manifest.profile}.`);
  if (!manifest.demo || !Array.isArray(manifest.pages) || !manifest.pages.some((page) => page.route === "/")) fail("Release manifest must include a demo and a package root page.");
  if (!Array.isArray(manifest.contents) || manifest.contents.some((item) => item.path === "release-manifest.json" || item.path === manifest.checksums)) fail("Release manifest content inventory must omit itself and its checksum inventory.");
  for (const item of manifest.contents || []) {
    const filename = path.resolve(packageRoot, ...normalizeArchivePath(item.path).split("/"));
    if (!filename.startsWith(`${path.resolve(packageRoot)}${path.sep}`) || !fs.existsSync(filename) || fs.statSync(filename).size !== item.sizeBytes) fail(`Release manifest has a missing or size-mismatched content entry: ${item.path}`);
  }
  for (const required of ["html", "source", "starter", "documentation", "CHANGELOG.md", "MIGRATION.md", "THIRD-PARTY-NOTICES.md", "PERFORMANCE-MEASUREMENTS.md", "PERFORMANCE-MEASUREMENTS.json", "CSP-HEADER.txt"]) {
    if (!fs.existsSync(path.join(packageRoot, required))) fail(`Required release output is missing: ${required}`);
  }
  if (fs.existsSync(path.join(packageRoot, "source/node_modules")) || fs.existsSync(path.join(packageRoot, "source/package-lock.json"))) fail("Release source must not include installed dependencies or npm's lockfile.");
  const sourceRoot = path.join(packageRoot, "source");
  const sourcePackage = JSON.parse(fs.readFileSync(path.join(sourceRoot, "package.json"), "utf8"));
  for (const required of ["docs/architecture/phase-0/route-inventory.md", "docs/guides/README.md", "docs/style-ownership.md"]) {
    if (!fs.existsSync(path.join(sourceRoot, required))) fail(`Release source documentation is missing: ${required}`);
  }
  for (const [name, command] of Object.entries(sourcePackage.scripts || {})) {
    for (const match of command.matchAll(/\bnode\s+(?:--test\s+)?([\w./*-]+\.(?:cjs|mjs|js))\b/g)) {
      const relative = match[1];
      const directory = path.join(sourceRoot, path.dirname(relative));
      const basename = path.basename(relative);
      const present = basename.includes("*")
        ? fs.existsSync(directory) && fs.readdirSync(directory).some((file) => {
          const [prefix, suffix] = basename.split("*");
          return file.startsWith(prefix) && file.endsWith(suffix);
        })
        : fs.existsSync(path.join(sourceRoot, relative));
      if (!present) fail(`Release source script ${name} references a missing file: ${relative}`);
    }
  }
  const checksumCount = verifyChecksums(packageRoot, manifest);
  const licenseCount = verifyLicenses(packageRoot);
  const inventory = JSON.parse(fs.readFileSync(path.join(packageRoot, manifest.licenses.inventory), "utf8"));
  if (manifest.licenses.packageCount !== licenseCount || inventory.packages.length !== licenseCount) fail("Release manifest license count does not match the inventory.");
  const html = verifyHtmlSite(packageRoot, manifest, "html");
  const starterManifest = {
    ...manifest,
    pages: manifest.starterPages || [],
  };
  if (starterManifest.pages.length) verifyHtmlSite(packageRoot, starterManifest, "starter", { expectedRobots: "noindex,nofollow" });
  return { checksumCount, licenseCount, ...html };
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--help" || args[0] === "-h") {
    process.stdout.write("Usage: node qa/release/smoke-extracted.cjs <release.zip> [--extract-to <dir>]\n       node qa/release/smoke-extracted.cjs --root <extracted-package-dir>\n");
    return;
  }
  let packageRoot = null;
  let archive = null;
  let extractTo = null;
  if (args[0] === "--root") {
    packageRoot = path.resolve(args[1] || "");
  } else {
    if (!args[0] || args[0].startsWith("--")) fail("Provide a release archive path or --root directory.");
    archive = path.resolve(args[0]);
    if (args[1] === "--extract-to") extractTo = path.resolve(args[2]);
    else if (args.length > 1) fail(`Unknown argument: ${args[1]}`);
  }
  let ownedTemp = null;
  if (archive) {
    if (!fs.existsSync(archive)) fail(`Release archive does not exist: ${archive}`);
    ownedTemp = extractTo || fs.mkdtempSync(path.join(require("node:os").tmpdir(), "theme-release-smoke-"));
    if (fs.existsSync(ownedTemp) && fs.readdirSync(ownedTemp).length) fail(`Refusing to extract into non-empty directory: ${ownedTemp}`);
    extractZipBuffer(fs.readFileSync(archive), ownedTemp);
    packageRoot = ownedTemp;
  }
  try {
    const result = verifyPackage(packageRoot);
    process.stdout.write(`Extracted release smoke passed: ${result.htmlFiles} HTML routes, ${result.linkedScripts} JS assets, ${result.checksumCount} checksums, ${result.licenseCount} licenses.\n`);
  } finally {
    if (ownedTemp && !extractTo && fs.existsSync(ownedTemp)) fs.rmSync(ownedTemp, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try { main(); }
  catch (error) { process.stderr.write(`smoke-extracted: ${error.message}\n`); process.exitCode = 1; }
}

module.exports = { verifyPackage, verifyHtmlSite };
