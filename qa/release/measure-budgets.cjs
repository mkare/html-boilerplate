#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const parse5 = require("parse5");

const KiB = 1024;
const LIMITS = Object.freeze({
  standardCssGzipBytes: 60 * KiB,
  standardJsGzipBytes: 70 * KiB,
  dashboardCommerceJsGzipBytes: 130 * KiB,
  allFontsRawBytes: 120 * KiB,
  largestRasterRawBytes: 180 * KiB,
  regressionRatio: 0.1,
});

function parseOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--help" || key === "-h") return { help: true };
    if (!["--root", "--manifest", "--base-path", "--write-markdown", "--write-json", "--baseline"].includes(key)) throw new Error(`Unknown option: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${key} requires a value.`);
    if (options[key]) throw new Error(`${key} may be specified once.`);
    options[key] = value;
    index += 1;
  }
  return options;
}

function bytes(root, relative) {
  return fs.readFileSync(path.join(root, ...relative.split("/")));
}

function outputPathFromUrl(value, { page, basePath, siteUrl, root }) {
  if (!value || /^(?:data:|blob:|mailto:|tel:|javascript:)/i.test(value)) return null;
  let parsed;
  const basePrefix = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  const sourceUrl = `${siteUrl || "https://release.invalid"}${basePrefix}${page.route === "/" ? "/" : page.route}`;
  try { parsed = new URL(value, sourceUrl); } catch { return null; }
  if (!/^https?:$/.test(parsed.protocol)) return null;
  const expectedOrigin = siteUrl ? new URL(siteUrl).origin : "https://release.invalid";
  if (parsed.origin !== expectedOrigin) return null;
  let pathname;
  try { pathname = decodeURIComponent(parsed.pathname); } catch { return null; }
  if (basePath !== "/") {
    if (!pathname.startsWith(basePath)) return null;
    pathname = `/${pathname.slice(basePath.length)}`;
  }
  if (!pathname || pathname.endsWith("/")) pathname += "index.html";
  const relative = pathname.replace(/^\/+/, "");
  const absolute = path.resolve(root, ...relative.split("/"));
  if (!absolute.startsWith(`${path.resolve(root)}${path.sep}`)) return null;
  return fs.existsSync(absolute) && fs.statSync(absolute).isFile() ? relative : null;
}

function collectReferences(tree) {
  const refs = { css: new Set(), js: new Set() };
  const visit = (node) => {
    if (node.tagName === "link") {
      const rel = (node.attrs?.find((attribute) => attribute.name === "rel")?.value || "").toLowerCase().split(/\s+/);
      if (rel.includes("stylesheet")) {
        const href = node.attrs?.find((attribute) => attribute.name === "href")?.value;
        if (href) refs.css.add(href);
      }
    }
    if (node.tagName === "script") {
      const src = node.attrs?.find((attribute) => attribute.name === "src")?.value;
      if (src) refs.js.add(src);
    }
    for (const child of node.childNodes || []) visit(child);
    if (node.content) visit(node.content);
  };
  visit(tree);
  return refs;
}

function fileMetrics(root, relative) {
  const content = bytes(root, relative);
  return {
    path: relative,
    rawBytes: content.length,
    gzipBytes: zlib.gzipSync(content, { level: 9, mtime: 0 }).length,
    brotliBytes: zlib.brotliCompressSync(content, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }).length,
  };
}

function measureReuse(pageMetrics, root) {
  const reuse = {};
  for (const type of ["css", "js"]) {
    const pagesByAsset = new Map();
    for (const [pageId, page] of Object.entries(pageMetrics)) {
      for (const asset of page[`${type}Files`]) {
        const pageIds = pagesByAsset.get(asset.path) || [];
        pageIds.push(pageId);
        pagesByAsset.set(asset.path, pageIds);
      }
    }
    const assets = [...pagesByAsset.entries()].map(([assetPath, pageIds]) => {
      const metrics = fileMetrics(root, assetPath);
      return { ...metrics, pageCount: pageIds.length, pages: pageIds.sort() };
    }).sort((left, right) => left.path.localeCompare(right.path));
    const pageReferencedRawBytes = assets.reduce((sum, asset) => sum + asset.rawBytes * asset.pageCount, 0);
    const pageReferencedGzipBytes = assets.reduce((sum, asset) => sum + asset.gzipBytes * asset.pageCount, 0);
    const pageReferencedBrotliBytes = assets.reduce((sum, asset) => sum + asset.brotliBytes * asset.pageCount, 0);
    const uniqueRawBytes = assets.reduce((sum, asset) => sum + asset.rawBytes, 0);
    const uniqueGzipBytes = assets.reduce((sum, asset) => sum + asset.gzipBytes, 0);
    const uniqueBrotliBytes = assets.reduce((sum, asset) => sum + asset.brotliBytes, 0);
    reuse[type] = {
      uniqueAssetCount: assets.length,
      pageReferencedRawBytes,
      pageReferencedGzipBytes,
      pageReferencedBrotliBytes,
      uniqueRawBytes,
      uniqueGzipBytes,
      uniqueBrotliBytes,
      repeatedReferenceRawBytes: pageReferencedRawBytes - uniqueRawBytes,
      repeatedReferenceGzipBytes: pageReferencedGzipBytes - uniqueGzipBytes,
      repeatedReferenceBrotliBytes: pageReferencedBrotliBytes - uniqueBrotliBytes,
      sharedAssets: assets.filter((asset) => asset.pageCount > 1),
    };
  }
  return reuse;
}

function findByteIdenticalFiles(root, files) {
  const byTypeAndHash = new Map();
  for (const file of files.filter((candidate) => [".css", ".js"].includes(path.extname(candidate).toLowerCase()))) {
    const content = bytes(root, file);
    const type = path.extname(file).toLowerCase().slice(1);
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    const key = `${type}:${hash}`;
    const group = byTypeAndHash.get(key) || { type, sha256: hash, rawBytes: content.length, paths: [] };
    group.paths.push(file);
    byTypeAndHash.set(key, group);
  }
  return [...byTypeAndHash.values()]
    .filter((group) => group.paths.length > 1)
    .map((group) => ({ ...group, paths: group.paths.sort(), duplicateRawBytes: group.rawBytes * (group.paths.length - 1) }))
    .sort((left, right) => left.type.localeCompare(right.type) || left.paths[0].localeCompare(right.paths[0]));
}

function measure(root, manifest, { basePath = manifest.site?.basePath || "/", baseline = null } = {}) {
  const absoluteRoot = path.resolve(root);
  if (!fs.existsSync(absoluteRoot) || !fs.statSync(absoluteRoot).isDirectory()) throw new Error(`Build root does not exist: ${absoluteRoot}`);
  if (!basePath.startsWith("/") || (basePath !== "/" && !basePath.endsWith("/"))) throw new Error(`Invalid base path: ${basePath}`);
  const pages = (manifest.pages || []).filter((page) => page.output);
  if (!pages.some((page) => page.id !== "system.404")) throw new Error("The supplied manifest contains no measurable pages.");
  const byType = new Map([["html", []], ["css", []], ["js", []], ["font", []], ["image", []]]);
  const pageMetrics = {};
  const referencedCss = new Set();
  const referencedJs = new Set();

  for (const page of pages) {
    const htmlFile = path.join(absoluteRoot, ...page.output.split("/"));
    if (!fs.existsSync(htmlFile)) throw new Error(`Missing page output for ${page.id}: ${page.output}`);
    const htmlBytes = fs.readFileSync(htmlFile);
    byType.get("html").push({ path: page.output, rawBytes: htmlBytes.length, gzipBytes: zlib.gzipSync(htmlBytes, { level: 9, mtime: 0 }).length });
    if (page.id === "system.404") continue;
    const htmlTree = parse5.parse(htmlBytes.toString("utf8"));
    const refs = collectReferences(htmlTree);
    const cssFiles = [...refs.css].map((url) => outputPathFromUrl(url, { page, basePath, siteUrl: manifest.site?.siteUrl || "", root: absoluteRoot })).filter(Boolean);
    const jsFiles = [...refs.js].map((url) => outputPathFromUrl(url, { page, basePath, siteUrl: manifest.site?.siteUrl || "", root: absoluteRoot })).filter(Boolean);
    cssFiles.forEach((file) => referencedCss.add(file));
    jsFiles.forEach((file) => referencedJs.add(file));
    const cssMetrics = [...new Set(cssFiles)].map((file) => fileMetrics(absoluteRoot, file));
    const jsMetrics = [...new Set(jsFiles)].map((file) => fileMetrics(absoluteRoot, file));
    const dashboardOrCommerce = /(?:dashboard|commerce|store)/i.test(`${page.id} ${page.route}`);
    pageMetrics[page.id] = {
      route: page.route,
      cssGzipBytes: cssMetrics.reduce((sum, item) => sum + item.gzipBytes, 0),
      jsGzipBytes: jsMetrics.reduce((sum, item) => sum + item.gzipBytes, 0),
      cssFiles: cssMetrics,
      jsFiles: jsMetrics,
      budgetClass: dashboardOrCommerce ? "dashboard-commerce" : "standard",
    };
  }

  const allFiles = [];
  const walk = (directory, relative = "") => {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, item.name);
      const key = relative ? `${relative}/${item.name}` : item.name;
      if (item.isDirectory()) walk(absolute, key);
      else if (item.isFile()) allFiles.push(key);
    }
  };
  walk(absoluteRoot);
  for (const file of allFiles) {
    const extension = path.extname(file).toLowerCase();
    const category = extension === ".css" ? "css"
      : extension === ".js" ? "js"
        : [".woff", ".woff2", ".ttf", ".otf", ".eot"].includes(extension) ? "font"
          : [".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"].includes(extension) ? "image"
            : null;
    if (category) byType.get(category).push(fileMetrics(absoluteRoot, file));
  }

  const aggregate = {};
  for (const [type, files] of byType) {
    const largest = [...files].sort((left, right) => right.rawBytes - left.rawBytes || left.path.localeCompare(right.path))[0] || null;
    aggregate[type] = {
      fileCount: files.length,
      rawBytes: files.reduce((sum, file) => sum + file.rawBytes, 0),
      gzipBytes: files.reduce((sum, file) => sum + file.gzipBytes, 0),
      brotliBytes: files.reduce((sum, file) => sum + file.brotliBytes, 0),
      largest,
      files: [...files].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0),
    };
  }

  const failures = [];
  for (const [pageId, metrics] of Object.entries(pageMetrics)) {
    const cssLimit = LIMITS.standardCssGzipBytes;
    const jsLimit = metrics.budgetClass === "dashboard-commerce" ? LIMITS.dashboardCommerceJsGzipBytes : LIMITS.standardJsGzipBytes;
    if (metrics.cssGzipBytes > cssLimit) failures.push(`${pageId} CSS ${metrics.cssGzipBytes} B gzip exceeds ${cssLimit} B.`);
    if (metrics.jsGzipBytes > jsLimit) failures.push(`${pageId} JS ${metrics.jsGzipBytes} B gzip exceeds ${jsLimit} B.`);
  }
  if (aggregate.font.rawBytes > LIMITS.allFontsRawBytes) failures.push(`Fonts total ${aggregate.font.rawBytes} B raw exceeds ${LIMITS.allFontsRawBytes} B.`);
  const rasterFiles = aggregate.image.files.filter((file) => !file.path.toLowerCase().endsWith(".svg"));
  const largestRaster = rasterFiles.sort((left, right) => right.rawBytes - left.rawBytes)[0] || null;
  if (largestRaster && largestRaster.rawBytes > LIMITS.largestRasterRawBytes) failures.push(`Largest raster image ${largestRaster.path} is ${largestRaster.rawBytes} B; limit is ${LIMITS.largestRasterRawBytes} B.`);

  const unusedCss = aggregate.css.files.map((item) => item.path).filter((file) => !referencedCss.has(file));
  const unusedJs = aggregate.js.files.map((item) => item.path).filter((file) => !referencedJs.has(file));
  if (unusedCss.length) failures.push(`Unreferenced CSS assets were emitted: ${unusedCss.join(", ")}.`);
  if (unusedJs.length) failures.push(`Unreferenced JS assets were emitted: ${unusedJs.join(", ")}.`);
  const missingReferenced = [...referencedCss, ...referencedJs].filter((file) => !fs.existsSync(path.join(absoluteRoot, ...file.split("/"))));
  if (missingReferenced.length) failures.push(`Referenced CSS/JS assets are missing: ${missingReferenced.join(", ")}.`);

  if (baseline?.pages) {
    for (const [pageId, current] of Object.entries(pageMetrics)) {
      const previous = baseline.pages[pageId];
      if (!previous) continue;
      pageMetrics[pageId].baseline = {};
      for (const key of ["cssGzipBytes", "jsGzipBytes"]) {
        const limit = Math.ceil(previous[key] * (1 + LIMITS.regressionRatio));
        const deltaBytes = current[key] - previous[key];
        pageMetrics[pageId].baseline[key] = {
          baselineBytes: previous[key],
          currentBytes: current[key],
          deltaBytes,
          percentChange: previous[key] === 0 ? (current[key] === 0 ? 0 : null) : Number(((deltaBytes / previous[key]) * 100).toFixed(2)),
          regressionLimitBytes: limit,
          passed: current[key] <= limit,
        };
        if (current[key] > limit) failures.push(`${pageId} ${key} regressed ${current[key]} B vs baseline ${previous[key]} B (+${Math.round(LIMITS.regressionRatio * 100)}% limit ${limit} B).`);
      }
    }
  }

  return {
    version: 1,
    measuredAt: manifest.buildNow || "",
    profile: manifest.profile,
    demo: manifest.selectedDemo,
    basePath,
    siteUrl: manifest.site?.siteUrl || "",
    limits: LIMITS,
    aggregate,
    pages: pageMetrics,
    assetReuse: measureReuse(pageMetrics, absoluteRoot),
    byteIdenticalAssets: findByteIdenticalFiles(absoluteRoot, allFiles),
    referencedAssets: { css: [...referencedCss].sort(), js: [...referencedJs].sort() },
    unusedCss,
    unusedJs,
    largestRaster,
    failures,
  };
}

function toMarkdown(report) {
  const rows = Object.entries(report.aggregate).map(([type, metrics]) => `| ${type.toUpperCase()} | ${metrics.fileCount} | ${metrics.rawBytes} | ${metrics.gzipBytes} | ${metrics.brotliBytes} | ${metrics.largest ? `${metrics.largest.path} (${metrics.largest.rawBytes} / ${metrics.largest.gzipBytes} / ${metrics.largest.brotliBytes})` : "—"} |`);
  const baselineValue = (comparison) => comparison
    ? `${comparison.baselineBytes} B → ${comparison.currentBytes} B (${comparison.deltaBytes >= 0 ? "+" : ""}${comparison.deltaBytes} B; ${comparison.percentChange === null ? "∞" : `${comparison.percentChange}%`})`
    : "—";
  const pageRows = Object.entries(report.pages).map(([id, metrics]) => `| \`${id}\` | ${metrics.cssGzipBytes} | ${metrics.jsGzipBytes} | ${baselineValue(metrics.baseline?.cssGzipBytes)} | ${baselineValue(metrics.baseline?.jsGzipBytes)} | ${metrics.budgetClass} |`);
  const reuseRows = ["css", "js"].flatMap((type) => report.assetReuse?.[type]?.sharedAssets.map((asset) => `| ${type.toUpperCase()} | \`${asset.path}\` | ${asset.pageCount} | ${asset.rawBytes} | ${asset.gzipBytes} | ${asset.pages.map((page) => `\`${page}\``).join(", ")} |`) || []);
  const duplicateRows = (report.byteIdenticalAssets || []).map((asset) => `| ${asset.type.toUpperCase()} | ${asset.rawBytes} | ${asset.duplicateRawBytes} | ${asset.paths.map((file) => `\`${file}\``).join(", ")} |`);
  const repeated = report.assetReuse
    ? `\n## Shared asset reuse and repeated page references\n\nThese figures sum each page's referenced CSS/JS bundle. The repeated-reference bytes are the excess over one copy of each referenced file; browsers can reuse identical URL responses from cache during navigation, so this is not a claim of repeated network transfer.\n\n| Type | Unique assets | Page references raw bytes | Page references gzip bytes | Page references Brotli bytes | Repeated-reference raw bytes | Repeated-reference gzip bytes | Repeated-reference Brotli bytes |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n${["css", "js"].map((type) => { const value = report.assetReuse[type]; return `| ${type.toUpperCase()} | ${value.uniqueAssetCount} | ${value.pageReferencedRawBytes} | ${value.pageReferencedGzipBytes} | ${value.pageReferencedBrotliBytes} | ${value.repeatedReferenceRawBytes} | ${value.repeatedReferenceGzipBytes} | ${value.repeatedReferenceBrotliBytes} |`; }).join("\n")}\n\n### Assets referenced by multiple pages\n\n| Type | Asset | Pages | Raw bytes | Gzip bytes | Brotli bytes | Page IDs |\n| --- | --- | ---: | ---: | ---: | ---: | --- |\n${reuseRows.length ? reuseRows.join("\n") : "| — | None | — | — | — | — | — |"}\n\n### Byte-identical distinct emitted CSS/JS files\n\n| Type | Bytes per file | Duplicate raw bytes beyond first copy | Paths |\n| --- | ---: | ---: | --- |\n${duplicateRows.length ? duplicateRows.join("\n") : "| — | None | — | — |"}\n`
    : "";
  return `# Release performance measurements\n\n- Profile: \`${report.profile}\`\n- Demo: \`${report.demo}\`\n- Base path: \`${report.basePath}\`\n- Build site URL: \`${report.siteUrl || "(unset)"}\`\n- Build input timestamp: \`${report.measuredAt}\` (fixed with --build-now for reproducibility)\n\nFiles are measured from the emitted build. Gzip uses Node zlib level 9 and Brotli uses quality 5 for reproducible file comparisons; host transfer settings may differ. Compression measurements are separate from minification. PNG, JPEG, WebP, and AVIF are already compressed, so their compressed results are inventory only. The largest raster image is a proxy for the mobile-hero-image budget; inspect actual viewport use separately. No field LCP/INP/CLS claim is made.\n\n## File inventory\n\n| Type | Files | Raw bytes | Gzip bytes | Brotli bytes | Largest (raw / gzip / Brotli bytes) |\n| --- | ---: | ---: | ---: | ---: | --- |\n${rows.join("\n")}\n\n## Per-page CSS/JS budgets\n\n| Page | CSS gzip bytes | JS gzip bytes | CSS vs baseline | JS vs baseline | Budget class |\n| --- | ---: | ---: | --- | --- | --- |\n${pageRows.join("\n")}\n${repeated}\n## Limits\n\n- Standard page CSS: ≤ ${report.limits.standardCssGzipBytes} B gzip per page.\n- Standard page JS: ≤ ${report.limits.standardJsGzipBytes} B gzip per page.\n- Dashboard/commerce page JS: ≤ ${report.limits.dashboardCommerceJsGzipBytes} B gzip per page.\n- Total font files: ≤ ${report.limits.allFontsRawBytes} B raw.\n- Largest raster image: ≤ ${report.limits.largestRasterRawBytes} B raw (approximate first-view proxy).\n- Regression: no more than +${Math.round(report.limits.regressionRatio * 100)}% from a recorded page-level gzip baseline.\n- Unrelated CSS assets: zero emitted but unreferenced.\n- Unrelated JS assets: zero emitted but unreferenced.\n\nThese caps align with plan §7. Historical initial-build values in the plan are separate baselines and are not substituted for this release's measurements.\n`;
}

function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    process.stdout.write("Usage: node qa/release/measure-budgets.cjs --root <html-dir> --manifest <pages-manifest.json> [--base-path /preview/theme/] [--baseline <json>] [--write-markdown <file>] [--write-json <file>]\n");
    return;
  }
  const repoRoot = path.resolve(__dirname, "../..");
  const root = path.resolve(options["--root"] || path.join(repoRoot, "dist"));
  const manifestPath = path.resolve(options["--manifest"] || path.join(repoRoot, ".generated/pages-manifest.json"));
  if (!fs.existsSync(manifestPath)) throw new Error(`Manifest does not exist: ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const baseline = options["--baseline"] ? JSON.parse(fs.readFileSync(path.resolve(options["--baseline"]), "utf8")) : null;
  const report = measure(root, manifest, { basePath: options["--base-path"] || manifest.site?.basePath || "/", baseline });
  if (options["--write-json"]) fs.writeFileSync(path.resolve(options["--write-json"]), `${JSON.stringify(report, null, 2)}\n`);
  if (options["--write-markdown"]) fs.writeFileSync(path.resolve(options["--write-markdown"]), toMarkdown(report));
  process.stdout.write(`Release budgets: ${report.demo}/${report.profile}; ${Object.keys(report.pages).length} pages; CSS/JS, fonts, image proxy, and unused JS checked.\n`);
  if (report.failures.length) {
    report.failures.forEach((failure) => process.stderr.write(`- ${failure}\n`));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  try { main(); }
  catch (error) { process.stderr.write(`measure-budgets: ${error.message}\n`); process.exitCode = 1; }
}

module.exports = { LIMITS, measure, toMarkdown };
