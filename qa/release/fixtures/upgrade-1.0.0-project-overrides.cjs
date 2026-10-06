"use strict";

// Independent synthetic snapshot of the 1.0.0 overlay reader. This is not a
// copy of the current production loader or a published historical release.
const fs = require("node:fs");
const path = require("node:path");

function readJson(root, relativePath) {
  const filename = path.join(root, relativePath);
  if (!fs.existsSync(filename)) throw new Error("Required upgrade fixture file is missing: " + relativePath);
  return JSON.parse(fs.readFileSync(filename, "utf8"));
}

function collectPageRecords(directory, demoId, records = []) {
  if (!fs.existsSync(directory)) return records;
  const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) collectPageRecords(filename, demoId, records);
    else if (entry.isFile() && entry.name === "page.json") {
      const record = JSON.parse(fs.readFileSync(filename, "utf8"));
      records.push({ ...record, demoId: record.demoId || demoId });
    }
  }
  return records;
}

function tokenScss(themes) {
  const blocks = [];
  for (const [theme, schemes] of Object.entries(themes)) {
    for (const [scheme, tokens] of Object.entries(schemes)) {
      const selector = scheme === "dark"
        ? 'html[data-theme="' + theme + '"][data-color-scheme="dark"]'
        : 'html[data-theme="' + theme + '"]';
      const declarations = Object.entries(tokens)
        .map(([name, value]) => "  " + name + ": " + value + ";")
        .join("\n");
      blocks.push(selector + " {\n" + declarations + "\n}");
    }
  }
  return blocks.join("\n\n") + "\n";
}

function loadProjectOverrides({ repoRoot, demoId = "saas" } = {}) {
  const root = path.resolve(repoRoot);
  const overridesRoot = path.join(root, "project/overrides");
  const brandRecord = readJson(overridesRoot, "brand.json");
  const themeRecord = readJson(overridesRoot, "theme.json");
  const navigation = readJson(overridesRoot, "navigation.json");
  const brand = {
    name: brandRecord.name,
    logo: brandRecord.logo,
    logoPath: path.join(root, "public", ...brandRecord.logo.split("/")),
  };
  const pageRecords = collectPageRecords(path.join(overridesRoot, "pages"), demoId);
  const tokensScssPath = path.join(root, ".generated/upgrade-rehearsal/1.0.0-tokens.scss");
  fs.mkdirSync(path.dirname(tokensScssPath), { recursive: true });
  fs.writeFileSync(tokensScssPath, tokenScss(themeRecord.themes));

  return {
    brand,
    themes: themeRecord.themes,
    navigation,
    pageRecords,
    tokensScssPath,
    customScssPath: path.join(overridesRoot, "custom.scss"),
    overrideRoot: overridesRoot,
  };
}

module.exports = { loadProjectOverrides };
