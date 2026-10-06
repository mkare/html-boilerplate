#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const parse5 = require("parse5");
const { createDeterministicZip, walkFiles } = require("../qa/release/archive.cjs");
const { measure, toMarkdown } = require("../qa/release/measure-budgets.cjs");
const { verifyPackage } = require("../qa/release/smoke-extracted.cjs");

const HELP = `Usage: node scripts/package-release.cjs --demo <saas|agency> --site-url <https://example.test> --build-now <ISO-8601> --out <release.zip> [options]

Options:
  --base-path <path>  Deployment mount (default: /; e.g. /preview/theme/)
  --root <directory>  Project root (default: current repository)
  --help              Show this help

The command builds release-html, starter, and catalog-preview in an isolated
temporary copy. The archive is written only to --out and refuses to overwrite.
The build time and public origin are explicit inputs so identical inputs produce
identical release bytes. No environment variables are copied into the archive.
`;

const PROJECT_ENTRIES = [
  "src", "build", "config", "public", "project/overrides", "scripts", "qa",
  "docs",
  "webpack.config.js", "package.json", "yarn.lock", ".nvmrc", ".browserslistrc", "README.md",
];

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--help" || key === "-h") return { help: true };
    if (!["--demo", "--site-url", "--build-now", "--out", "--base-path", "--root"].includes(key)) throw new Error(`Unknown option: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${key} requires a value.`);
    if (options[key]) throw new Error(`${key} may be specified once.`);
    options[key] = value;
    index += 1;
  }
  return options;
}

function assertSupportedNode() {
  if (process.versions.node !== "22.23.2") throw new Error(`Node 22.23.2 is required for reproducible releases; received ${process.versions.node}.`);
}

function validateOptions(options) {
  const demo = (options["--demo"] || "").toLowerCase();
  if (!new Set(["saas", "agency"]).has(demo)) throw new Error("--demo must be saas or agency.");
  const siteUrl = options["--site-url"] || "";
  let parsedSite;
  try { parsedSite = new URL(siteUrl); } catch { throw new Error("--site-url must be an explicit http(s) URL."); }
  if (!new Set(["http:", "https:"]).has(parsedSite.protocol) || parsedSite.username || parsedSite.password || parsedSite.search || parsedSite.hash || parsedSite.pathname !== "/") {
    throw new Error("--site-url must be an origin only, such as https://www.example.com (no credentials, path, query, or fragment).");
  }
  const siteOrigin = parsedSite.origin;
  const buildNowInput = options["--build-now"] || "";
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/i.test(buildNowInput)) throw new Error("--build-now must be an ISO-8601 timestamp with seconds and an explicit UTC offset or Z.");
  const date = new Date(buildNowInput);
  if (Number.isNaN(date.getTime())) throw new Error("--build-now is not a valid ISO-8601 timestamp.");
  const buildNow = date.toISOString();
  const basePath = options["--base-path"] || "/";
  let decodedBasePath;
  try { decodedBasePath = decodeURIComponent(basePath); } catch { throw new Error("--base-path contains invalid percent encoding."); }
  if (!basePath.startsWith("/") || (basePath !== "/" && !basePath.endsWith("/")) || /[?#\\\s]/.test(basePath) || /[?#\\\s]/.test(decodedBasePath) || basePath.includes("//") || /%2f|%5c/i.test(basePath) || decodedBasePath.split("/").some((segment) => segment === "." || segment === "..")) {
    throw new Error("--base-path must be / or a canonical root-relative directory ending in /.");
  }
  if (!options["--out"]) throw new Error("--out is required.");
  return {
    demo,
    siteUrl: siteOrigin,
    buildNow,
    basePath,
    root: path.resolve(options["--root"] || path.resolve(__dirname, "..")),
    output: path.resolve(options["--out"] || ""),
  };
}

function ensureOutputDoesNotExist(options) {
  if (options.output === path.parse(options.output).root || options.output === options.root) throw new Error("--out must name a file outside the project root.");
  if (!options.output.toLowerCase().endsWith(".zip")) throw new Error("--out must use the .zip extension.");
  if (options.output.startsWith(`${options.root}${path.sep}`)) throw new Error("Refusing to write a generated release inside the source project; choose an external --out path.");
  if (fs.existsSync(options.output)) throw new Error(`Refusing to overwrite existing output: ${options.output}`);
}

function copyTree(source, destination, { omit = new Set() } = {}) {
  if (!fs.existsSync(source)) throw new Error(`Required release input is missing: ${source}`);
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) throw new Error(`Refusing to package symbolic link: ${source}`);
  if (stat.isFile()) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
    return;
  }
  fs.mkdirSync(destination, { recursive: true });
  for (const item of fs.readdirSync(source, { withFileTypes: true }).sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
    if (omit.has(item.name)) continue;
    const from = path.join(source, item.name);
    const to = path.join(destination, item.name);
    if (item.isSymbolicLink()) throw new Error(`Refusing to package symbolic link: ${from}`);
    if (item.isDirectory()) copyTree(from, to, { omit });
    else if (item.isFile()) copyTree(from, to, { omit });
  }
}

function copyProjectSources(root, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const relative of PROJECT_ENTRIES) {
    const source = path.join(root, relative);
    if (["public", "project/overrides"].includes(relative) && !fs.existsSync(source)) continue;
    const omit = relative === "qa"
      ? new Set(fs.readdirSync(source).filter((name) => name === "framework-acceptance" || name.startsWith("framework-status-")))
      : relative === "docs" ? new Set(["reviews"]) : new Set();
    copyTree(source, path.join(target, relative), { omit });
  }
}

function copyProjectForBuild(root, target) {
  copyProjectSources(root, target);
  const nodeModules = path.join(root, "node_modules");
  if (!fs.existsSync(nodeModules)) throw new Error("node_modules is missing. Install the declared Yarn dependencies before packaging.");
  fs.symlinkSync(nodeModules, path.join(target, "node_modules"), "dir");
}

function childEnvironment(options) {
  const environment = {};
  for (const key of ["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "LANG", "SYSTEMROOT"]) {
    if (process.env[key]) environment[key] = process.env[key];
  }
  Object.assign(environment, {
    BASE_PATH: options.basePath,
    ASSET_BASE: options.basePath,
    SITE_URL: options.siteUrl,
    BUILD_DEMO: options.demo,
    BUILD_NOW: options.buildNow,
  });
  return environment;
}

function runBuild(projectRoot, options, profile) {
  const cli = path.join(projectRoot, "node_modules/webpack-cli/bin/cli.js");
  if (!fs.existsSync(cli)) throw new Error(`webpack-cli entry was not found: ${cli}`);
  const result = spawnSync(process.execPath, [cli, "build", "--mode", "production", "--config", path.join(projectRoot, "webpack.config.js"), "--env", `profile=${profile}`, "--env", `demo=${options.demo}`], {
    cwd: projectRoot,
    env: childEnvironment(options),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = `${result.stdout || ""}\n${result.stderr || ""}`.trim().split(/\r?\n/).slice(-100).join("\n");
    throw new Error(`${profile} build failed (exit ${result.status}).\n${details}`);
  }
  const dist = path.join(projectRoot, "dist");
  const manifestPath = path.join(projectRoot, ".generated/pages-manifest.json");
  if (!fs.existsSync(dist) || !fs.existsSync(manifestPath)) throw new Error(`${profile} build did not publish dist/ and pages-manifest.json.`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.profile !== profile || manifest.selectedDemo !== options.demo) throw new Error(`Expected ${profile}/${options.demo}; manifest has ${manifest.profile}/${manifest.selectedDemo}.`);
  return { dist, manifest, log: `${result.stdout || ""}${result.stderr || ""}` };
}

function copyDist(build, destination) {
  if (fs.existsSync(destination)) fs.rmSync(destination, { recursive: true, force: true });
  copyTree(build.dist, destination);
}

function restoreRouteLinks(htmlRoot, pages, basePath, siteUrl) {
  const basePrefix = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  const htmlFiles = walkFiles(htmlRoot).filter((file) => file.relative.endsWith(".html"));
  for (const { absolute } of htmlFiles) {
    let html = fs.readFileSync(absolute, "utf8");
    for (const page of pages) {
      const target = `${basePrefix}${page.route}`;
      const truncated = target === "/" ? "" : target.slice(0, -1);
      const damaged = `href=${truncated} />`;
      if (html.includes(damaged)) html = html.replaceAll(damaged, `href="${target}">`);
      const canonical = `${siteUrl}${target}`;
      const damagedCanonical = canonical === `${siteUrl}/` ? `${siteUrl} />` : `${siteUrl}${target.slice(0, -1)} />`;
      for (const attribute of ["href", "content"]) {
        const broken = `${attribute}=${damagedCanonical}`;
        if (html.includes(broken)) html = html.replaceAll(broken, `${attribute}="${canonical}">`);
      }
    }
    fs.writeFileSync(absolute, html);
  }
}

function removeRuntimeOnlyChunk(htmlRoot, manifest, basePath, baseline) {
  const report = measure(htmlRoot, manifest, { basePath, baseline });
  const jsFiles = walkFiles(htmlRoot).filter((file) => file.relative.endsWith(".js"));
  if (jsFiles.length !== 1 || report.unusedJs.length !== 1 || report.unusedJs[0] !== jsFiles[0].relative || !/(?:^|\/)runtime\.[a-f0-9]+\.js$/i.test(jsFiles[0].relative)) return;
  fs.rmSync(jsFiles[0].absolute);
}

function htmlAttributes(document) {
  const found = [];
  const visit = (node) => {
    if (node.tagName) found.push({ tag: node.tagName, attrs: Object.fromEntries((node.attrs || []).map((attribute) => [attribute.name, attribute.value])), text: node.childNodes?.map((child) => child.value || "").join("") || "" });
    for (const child of node.childNodes || []) visit(child);
    if (node.content) visit(node.content);
  };
  visit(document);
  return found;
}

function collectCspHashes(htmlRoot, pages) {
  const scriptHashes = new Set();
  const styleHashes = new Set();
  const styleAttributeHashes = new Set();
  for (const page of pages) {
    const filename = path.join(htmlRoot, ...page.output.split("/"));
    const document = parse5.parse(fs.readFileSync(filename, "utf8"));
    const visit = (node) => {
      if (node.tagName === "script" && !node.attrs?.some((attribute) => attribute.name === "src")) {
        const content = node.childNodes?.map((child) => child.value || "").join("") || "";
        scriptHashes.add(`'sha256-${crypto.createHash("sha256").update(content).digest("base64")}'`);
      }
      if (node.tagName === "style") {
        const content = node.childNodes?.map((child) => child.value || "").join("") || "";
        styleHashes.add(`'sha256-${crypto.createHash("sha256").update(content).digest("base64")}'`);
      }
      const style = node.attrs?.find((attribute) => attribute.name === "style");
      if (style) styleAttributeHashes.add(`'sha256-${crypto.createHash("sha256").update(style.value).digest("base64")}'`);
      for (const child of node.childNodes || []) visit(child);
      if (node.content) visit(node.content);
    };
    visit(document);
  }
  return { scriptHashes: [...scriptHashes].sort(), styleHashes: [...styleHashes].sort(), styleAttributeHashes: [...styleAttributeHashes].sort() };
}

function createCspPolicy(hashes) {
  if (!hashes.scriptHashes.length) throw new Error("No first-paint inline theme script was found; release CSP cannot prove the theme path.");
  const directives = [
    "default-src 'self'",
    `script-src 'self' ${hashes.scriptHashes.join(" ")}`,
    `style-src 'self'${hashes.styleHashes.length ? ` ${hashes.styleHashes.join(" ")}` : ""}`,
    ...(hashes.styleAttributeHashes.length ? [`style-src-attr 'unsafe-hashes' ${hashes.styleAttributeHashes.join(" ")}`] : []),
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ];
  const policy = `Content-Security-Policy: ${directives.join("; ")}\n`;
  if (/unsafe-inline/i.test(policy)) throw new Error("Generated CSP unexpectedly contains unsafe-inline.");
  return policy;
}

function verifyProfileMetadata(builds) {
  const profiles = [
    ["catalog-preview", builds.preview, "noindex,follow"],
    ["starter", builds.starter, "noindex,nofollow"],
  ];
  for (const [profile, build, expected] of profiles) {
    const htmlOutputs = walkFiles(build.dist).filter((file) => file.relative.endsWith(".html"));
    if (htmlOutputs.length !== build.manifest.pages.length) throw new Error(`${profile} emitted ${htmlOutputs.length} HTML files for ${build.manifest.pages.length} manifest pages.`);
    for (const page of build.manifest.pages) {
      const filename = path.join(build.dist, ...page.output.split("/"));
      const document = parse5.parse(fs.readFileSync(filename, "utf8"));
      const robots = htmlAttributes(document).find((item) => item.tag === "meta" && item.attrs.name?.toLowerCase() === "robots")?.attrs.content?.toLowerCase().replace(/\s/g, "") || "";
      if (robots !== expected) throw new Error(`${profile} ${page.id} robots is "${robots}"; expected "${expected}".`);
    }
  }
  if (fs.existsSync(path.join(builds.preview.dist, "sitemap.xml"))) throw new Error("catalog-preview emitted a sitemap.");

  for (const page of builds.release.manifest.pages) {
    const filename = path.join(builds.release.dist, ...page.output.split("/"));
    const document = parse5.parse(fs.readFileSync(filename, "utf8"));
    const robots = htmlAttributes(document).find((item) => item.tag === "meta" && item.attrs.name?.toLowerCase() === "robots")?.attrs.content?.trim() || "";
    const expected = page.robots || (page.id === "system.404" ? "noindex,follow" : "");
    if (robots !== expected) throw new Error(`release-html page ${page.id} robots is "${robots}"; expected source metadata "${expected}". Preview metadata may have leaked.`);
  }
}

function listThirdPartyPackages(root, documentationRoot) {
  const nodeModules = path.join(root, "node_modules");
  const found = new Map();
  const seenPackages = new Set();
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
      if (entry.name === ".bin" || entry.name === ".cache") continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (!entry.isDirectory()) continue;
      const packageFile = path.join(absolute, "package.json");
      if (fs.existsSync(packageFile) && !seenPackages.has(packageFile)) {
        seenPackages.add(packageFile);
        let metadata;
        try { metadata = JSON.parse(fs.readFileSync(packageFile, "utf8")); } catch { metadata = null; }
        if (metadata?.name && metadata?.version) {
          const license = typeof metadata.license === "string"
            ? metadata.license
            : metadata.license && typeof metadata.license.type === "string"
              ? metadata.license.type
              : Array.isArray(metadata.licenses) ? metadata.licenses.map((item) => item.type).filter(Boolean).join(" OR ") : "";
          if (!license) throw new Error(`Third-party license is missing for ${metadata.name}@${metadata.version} (${path.relative(root, absolute)}).`);
          const key = `${metadata.name}@${metadata.version}`;
          if (!found.has(key)) {
            const safeName = key.normalize("NFKD").replace(/[^A-Za-z0-9@._+-]+/g, "-").replace(/[/\\]/g, "__");
            const licenseDirectory = path.join(documentationRoot, "licenses", safeName);
            const licenseFiles = [];
            for (const item of fs.readdirSync(absolute, { withFileTypes: true })) {
              if (!item.isFile() || !/^(?:licen[cs]e|copying|notice)(?:[._ -].*)?$/i.test(item.name)) continue;
              const relative = `${safeName}/${item.name}`;
              fs.mkdirSync(licenseDirectory, { recursive: true });
              fs.copyFileSync(path.join(absolute, item.name), path.join(documentationRoot, "licenses", relative), fs.constants.COPYFILE_EXCL);
              licenseFiles.push(relative);
            }
            found.set(key, {
              name: metadata.name,
              version: metadata.version,
              license,
              packagePath: path.relative(root, absolute).split(path.sep).join("/"),
              licenseFiles: licenseFiles.sort(),
            });
          }
        }
      }
      visit(absolute);
    }
  };
  visit(nodeModules);
  const packages = [...found.values()].sort((left, right) => (
    left.name < right.name ? -1 : left.name > right.name ? 1
      : left.version < right.version ? -1 : left.version > right.version ? 1 : 0
  ));
  const inventory = { schemaVersion: 1, source: "installed Yarn dependency tree; one record per name/version", packages };
  const indexFile = path.join(documentationRoot, "licenses/inventory.json");
  fs.mkdirSync(path.dirname(indexFile), { recursive: true });
  fs.writeFileSync(indexFile, `${JSON.stringify(inventory, null, 2)}\n`);
  const rows = packages.map((item) => `| ${item.name} | ${item.version} | ${item.license.replace(/\|/g, "\\|")} | ${item.licenseFiles.length} |`).join("\n");
  const notices = `# Third-party notices\n\nThis release includes the source/build dependencies listed below, based on the installed Yarn dependency tree used to build it. License texts found in package roots are stored under documentation/licenses/<package>@<version>/. A package with no standalone license file still has its declared SPDX/license expression recorded here; review any license obligations before redistribution.\n\n| Package | Version | Declared license | Included license files |\n| --- | --- | --- | ---: |\n${rows}\n`;
  fs.writeFileSync(path.join(documentationRoot, "licenses/THIRD-PARTY-NOTICES.md"), notices);
  return { packages, notices };
}

function copyDocumentation(root, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const relative of ["docs/guides", "docs/migrations", "docs/release"]) {
    const source = path.join(root, relative);
    if (fs.existsSync(source)) copyTree(source, path.join(destination, relative.replace(/^docs\//, "")));
  }
  const readme = path.join(root, "README.md");
  if (fs.existsSync(readme)) fs.copyFileSync(readme, path.join(destination, "README-framework.md"), fs.constants.COPYFILE_EXCL);
  const referenceDir = path.join(root, "docs/adr");
  if (fs.existsSync(referenceDir)) {
    const selected = ["ADR-005-build-and-delivery-profiles.md", "ADR-006-milestones-and-v1-scope.md", "ADR-007-package-manager-and-node.md", "ADR-009-accessibility-target.md"];
    for (const name of selected) {
      const source = path.join(referenceDir, name);
      if (fs.existsSync(source)) copyTree(source, path.join(destination, "adr", name));
    }
  }
}

function copyPackageSource(root, destination) {
  copyProjectSources(root, destination);
}

function safeDeleteTemp(directory) {
  const absolute = path.resolve(directory);
  const tempRoot = path.resolve(os.tmpdir());
  if (!absolute.startsWith(`${tempRoot}${path.sep}`)) throw new Error(`Refusing to remove non-temporary directory: ${absolute}`);
  fs.rmSync(absolute, { recursive: true, force: true });
}

function packageRelease(options) {
  assertSupportedNode();
  ensureOutputDoesNotExist(options);
  if (!fs.existsSync(path.join(options.root, "package.json")) || !fs.existsSync(path.join(options.root, "webpack.config.js"))) throw new Error(`--root does not look like the framework repository: ${options.root}`);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "multipurpose-release-"));
  try {
    const workRoot = path.join(tempRoot, "work");
    const outputRoot = path.join(tempRoot, "package");
    const buildCopies = path.join(tempRoot, "builds");
    copyProjectForBuild(options.root, workRoot);
    fs.mkdirSync(buildCopies, { recursive: true });
    const profiles = {};
    for (const profile of ["release-html", "starter", "catalog-preview"]) {
      const build = runBuild(workRoot, options, profile);
      const copyPath = path.join(buildCopies, profile);
      copyDist(build, copyPath);
      profiles[profile] = { dist: copyPath, manifest: build.manifest };
    }
    verifyProfileMetadata({ release: profiles["release-html"], starter: profiles.starter, preview: profiles["catalog-preview"] });
    const releaseManifest = profiles["release-html"].manifest;

    fs.mkdirSync(outputRoot, { recursive: true });
    copyTree(profiles["release-html"].dist, path.join(outputRoot, "html"));
    restoreRouteLinks(path.join(outputRoot, "html"), releaseManifest.pages, options.basePath, options.siteUrl);
    copyTree(profiles.starter.dist, path.join(outputRoot, "starter"));
    copyPackageSource(options.root, path.join(outputRoot, "source"));
    copyDocumentation(options.root, path.join(outputRoot, "documentation"));
    fs.writeFileSync(path.join(outputRoot, "documentation/README.md"), `# Release documentation\n\nThis release was built with Node 22.23.2 for demo \`${options.demo}\` at base path \`${options.basePath}\`. Start at the guides and upgrade notes in this folder.\n`, { flag: "wx" });

    const licenses = listThirdPartyPackages(options.root, path.join(outputRoot, "documentation"));
    fs.copyFileSync(path.join(outputRoot, "documentation/licenses/THIRD-PARTY-NOTICES.md"), path.join(outputRoot, "THIRD-PARTY-NOTICES.md"), fs.constants.COPYFILE_EXCL);
    const migrationGuide = path.join(outputRoot, "documentation/migrations/upgrade-guide.md");
    if (!fs.existsSync(migrationGuide)) throw new Error("docs/migrations/upgrade-guide.md is required to package a release.");
    fs.copyFileSync(migrationGuide, path.join(outputRoot, "MIGRATION.md"), fs.constants.COPYFILE_EXCL);
    const changelog = `# Changelog\n\n## ${JSON.parse(fs.readFileSync(path.join(options.root, "package.json"), "utf8")).version} — ${options.buildNow.slice(0, 10)}\n\n- Release profile: release-html for ${options.demo}.\n- Preview, starter, root/subpath, link, CSP, license and checksum checks run during packaging.\n- Static forms and demo account flows do not send data or provide backend services.\n`;
    fs.writeFileSync(path.join(outputRoot, "CHANGELOG.md"), changelog);

    const starterManifest = profiles.starter.manifest;
    const productionPages = releaseManifest.pages.map((page) => ({ id: page.id, route: page.route, output: page.output, title: page.title, locale: page.locale, robots: page.robots }));
    const starterPages = starterManifest.pages.map((page) => ({ id: page.id, route: page.route, output: page.output, title: page.title, locale: page.locale }));
    const cspHashes = collectCspHashes(path.join(outputRoot, "html"), releaseManifest.pages);
    fs.writeFileSync(path.join(outputRoot, "CSP-HEADER.txt"), createCspPolicy(cspHashes));

    const baselinePath = path.join(options.root, "qa/release/baselines", `${options.demo}.json`);
    const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, "utf8")) : null;
    removeRuntimeOnlyChunk(path.join(outputRoot, "html"), releaseManifest, options.basePath, baseline);
    const budgetReport = measure(path.join(outputRoot, "html"), releaseManifest, { basePath: options.basePath, baseline });
    if (budgetReport.failures.length) throw new Error(`Release performance budget failed:\n${budgetReport.failures.map((item) => `- ${item}`).join("\n")}`);
    fs.writeFileSync(path.join(outputRoot, "PERFORMANCE-MEASUREMENTS.md"), toMarkdown(budgetReport));
    fs.writeFileSync(path.join(outputRoot, "PERFORMANCE-MEASUREMENTS.json"), `${JSON.stringify(budgetReport, null, 2)}\n`);

    const payload = walkFiles(outputRoot).map(({ absolute, relative }) => ({ path: relative, sizeBytes: fs.statSync(absolute).size }));
    const packageInfo = JSON.parse(fs.readFileSync(path.join(options.root, "package.json"), "utf8"));
    const releaseDocument = {
      schemaVersion: 1,
      framework: { name: packageInfo.name, version: packageInfo.version, node: "22.23.2", packageManager: "yarn@1.22.22" },
      profile: "release-html",
      demo: options.demo,
      siteUrl: options.siteUrl,
      basePath: options.basePath,
      buildNow: options.buildNow,
      html: { root: "html/", profile: releaseManifest.profile, pageCount: productionPages.length },
      starter: { root: "starter/", profile: starterManifest.profile, pageCount: starterPages.length },
      pages: productionPages,
      starterPages,
      checksums: "checksums.sha256",
      checksumScope: "all package files except checksums.sha256; release-manifest.json is intentionally not self-checksummed",
      licenses: { inventory: "documentation/licenses/inventory.json", packageCount: licenses.packages.length },
      csp: { headerFile: "CSP-HEADER.txt", disallowsUnsafeInline: true, inlineScriptHashes: cspHashes.scriptHashes, inlineStyleHashes: cspHashes.styleHashes, inlineStyleAttributeHashes: cspHashes.styleAttributeHashes },
      budgets: { measurements: "PERFORMANCE-MEASUREMENTS.md", machineReport: "PERFORMANCE-MEASUREMENTS.json", hardLimitsPassed: true, regressionBaseline: baseline ? `qa/release/baselines/${options.demo}.json` : null, fieldPerformanceClaim: false },
      contents: payload,
    };
    fs.writeFileSync(path.join(outputRoot, "release-manifest.json"), `${JSON.stringify(releaseDocument, null, 2)}\n`);

    const checksumEntries = walkFiles(outputRoot).filter((file) => file.relative !== "checksums.sha256").map(({ absolute, relative }) => `${crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex")}  ${relative}`).sort();
    fs.writeFileSync(path.join(outputRoot, "checksums.sha256"), `${checksumEntries.join("\n")}\n`);

    const extracted = path.join(tempRoot, "extracted");
    const names = walkFiles(outputRoot).map(({ absolute, relative }) => ({ name: relative, data: fs.readFileSync(absolute) }));
    const zip = createDeterministicZip(names);
    fs.writeFileSync(path.join(tempRoot, "release.zip"), zip);
    const { extractZipBuffer } = require("../qa/release/archive.cjs");
    extractZipBuffer(zip, extracted);
    const smoke = verifyPackage(extracted);
    const cspCheck = require("../qa/release/check-csp.cjs").verifyCsp(extracted);

    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, zip, { flag: "wx" });
    const checksum = crypto.createHash("sha256").update(zip).digest("hex");
    process.stdout.write(`Release package created: ${options.output}\n`);
    process.stdout.write(`Inputs: demo=${options.demo}, profile=release-html, basePath=${options.basePath}, siteUrl=${options.siteUrl}, buildNow=${options.buildNow}\n`);
    process.stdout.write(`Archive: ${zip.length} bytes; SHA-256 ${checksum}; ${smoke.htmlFiles} production routes, ${smoke.licenseCount} third-party package licenses, ${smoke.checksumCount} checksummed files.\n`);
    process.stdout.write(`CSP first-paint check: ${cspCheck.pagesChecked} pages; ${cspCheck.inlineScriptHashes} inline script hash(es); unsafe-inline/eval disabled. Budgets passed.\n`);
    return { output: options.output, checksum, bytes: zip.length, pages: smoke.htmlFiles, licenses: smoke.licenseCount };
  } finally {
    safeDeleteTemp(tempRoot);
  }
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) { process.stdout.write(HELP); return; }
  const options = validateOptions(parsed);
  packageRelease(options);
}

if (require.main === module) {
  try { main(); }
  catch (error) { process.stderr.write(`package-release: ${error.message}\n`); process.exitCode = 1; }
}

module.exports = { parseArgs, validateOptions, packageRelease, createCspPolicy, collectCspHashes };
