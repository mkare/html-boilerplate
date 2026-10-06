#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const HELP = `Usage: node scripts/create-page.cjs --id <page.id> --route </path/> [options]

Options:
  --title <text>       Visible page title (defaults from --id)
  --locale <tag>       BCP-47 locale (default: en)
  --layout <name>      Existing layout (default: site)
  --theme <name>       Existing theme (default: default)
  --root <directory>   Project root (default: current directory; useful for fixtures)
  --help               Show this help

Creates src/pages/custom/<id>/page.json, page.pug, and page.scss. Existing files
are never overwritten. Site links added to the page should use route(pageId).
`;

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--help" || key === "-h") return { help: true };
    if (!/^--[a-z-]+$/.test(key)) throw new Error(`Unexpected argument: ${key}`);
    if (!new Set(["--id", "--route", "--title", "--locale", "--layout", "--theme", "--root"]).has(key)) {
      throw new Error(`Unknown option: ${key}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${key} requires a value.`);
    if (values[key]) throw new Error(`${key} may be specified once.`);
    values[key] = value;
    index += 1;
  }
  return values;
}

function validateId(id) {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(id || "")) {
    throw new Error("--id must be lowercase letters/digits followed by lowercase letters, digits, dot, underscore, or hyphen.");
  }
}

function validateRoute(route) {
  if (typeof route !== "string" || !route.startsWith("/") || (route !== "/" && !route.endsWith("/"))) {
    throw new Error("--route must be a canonical root-relative route ending in / (or exactly /).");
  }
  let decoded;
  try { decoded = decodeURIComponent(route); } catch { throw new Error("--route contains invalid percent encoding."); }
  if (/[?#\\\s]/.test(route) || /[?#\\\s]/.test(decoded) || route.includes("//") || /%2f|%5c/i.test(route)) {
    throw new Error("--route cannot contain query, fragment, whitespace, backslash, or encoded path separators.");
  }
  const segments = decoded.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) throw new Error("--route cannot contain dot segments.");
  return route;
}

function collectRecords(root) {
  const records = [];
  for (const relativeRoot of ["src/pages", "src/views"]) {
    const directory = path.join(root, relativeRoot);
    if (!fs.existsSync(directory)) continue;
    const visit = (current) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) visit(absolute);
        else if (entry.isFile() && entry.name === "page.json") {
          try { records.push(JSON.parse(fs.readFileSync(absolute, "utf8"))); }
          catch (error) { throw new Error(`Cannot inspect ${path.relative(root, absolute)}: ${error.message}`, { cause: error }); }
        }
      }
    };
    visit(directory);
  }
  return records;
}

function titleFromId(id) {
  return id.split(/[._-]+/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

function declaredLayouts(root, records) {
  const layouts = new Set(["site"]);
  for (const record of records) if (typeof record.layout === "string") layouts.add(record.layout);
  const directory = path.join(root, "src/layouts");
  if (fs.existsSync(directory)) {
    for (const name of fs.readdirSync(directory)) if (name.endsWith(".pug")) layouts.add(name.slice(0, -4));
  }
  return layouts;
}

function declaredThemes(root, records) {
  const themes = new Set(["default"]);
  for (const record of records) if (typeof record.theme === "string") themes.add(record.theme);
  const source = path.join(root, "src/scss/theme.scss");
  if (fs.existsSync(source)) {
    const stylesheet = fs.readFileSync(source, "utf8");
    for (const match of stylesheet.matchAll(/data-theme\s*=\s*["']([^"']+)["']/g)) themes.add(match[1]);
  }
  return themes;
}

function assertSafeTarget(root, relativePath) {
  let current = path.resolve(root);
  for (const segment of relativePath.split(path.sep)) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) continue;
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Refusing to follow symbolic link in scaffold path: ${path.relative(root, current)}`);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { process.stdout.write(HELP); return; }
  const id = options["--id"];
  const route = options["--route"];
  validateId(id);
  validateRoute(route);

  const locale = options["--locale"] || "en";
  if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(locale)) throw new Error("--locale must be a BCP-47 style language tag.");
  const layout = options["--layout"] || "site";
  if (!/^[a-z][a-z0-9-]*$/.test(layout)) throw new Error("--layout must be a lowercase layout identifier.");
  const theme = options["--theme"] || "default";
  if (!/^[a-z][a-z0-9-]*$/.test(theme)) throw new Error("--theme must be a lowercase theme identifier.");
  const title = options["--title"] || titleFromId(id);
  if (!title.trim()) throw new Error("--title cannot be empty.");

  const root = path.resolve(options["--root"] || process.cwd());
  const records = collectRecords(root);
  if (!declaredLayouts(root, records).has(layout)) throw new Error(`--layout must name a currently declared layout; received "${layout}".`);
  if (!declaredThemes(root, records).has(theme)) throw new Error(`--theme must name a currently declared theme; received "${theme}".`);
  const normalizedId = id.normalize("NFC").toLocaleLowerCase("en-US");
  if (records.some((record) => typeof record.id === "string" && record.id.normalize("NFC").toLocaleLowerCase("en-US") === normalizedId)) {
    throw new Error(`Page id already exists: ${id}`);
  }
  if (records.some((record) => record.route === route)) {
    throw new Error(`Route already exists in a page record: ${route}`);
  }

  const slug = id.replace(/[._]+/g, "-");
  const relativeDirectory = path.posix.join("src/pages/custom", slug);
  const directory = path.resolve(root, relativeDirectory);
  if (!directory.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error("Resolved scaffold path escapes the project root.");
  assertSafeTarget(root, path.join("src", "pages", "custom", slug));
  if (fs.existsSync(directory)) throw new Error(`Refusing to write into existing directory: ${relativeDirectory}`);
  const files = {
    "page.json": `${JSON.stringify({
      id,
      route,
      source: `${relativeDirectory}/page.pug`,
      styles: [`${relativeDirectory}/page.scss`],
      layout,
      theme,
      locale,
      direction: "ltr",
      title,
      description: "A new static page scaffold.",
    }, null, 2)}\n`,
    "page.pug": `extends @layouts/base.pug\n\nblock head\n  link(href="@pages/custom/${slug}/page.scss" rel="stylesheet")\n  if siteUrl\n    link(rel="canonical" href=siteUrl + route(pageId))\n\nblock content\n  section.custom-page(aria-labelledby="custom-page-title")\n    .container\n      h1#custom-page-title= title\n      p Replace this copy with page content. Use route("page.id") for internal links.\n`,
    "page.scss": `// Page-owned styles for ${id}. Keep selectors local to .custom-page.\n.custom-page {\n  padding-block: clamp(3rem, 8vw, 6rem);\n}\n`,
  };
  for (const name of Object.keys(files)) {
    const target = path.join(directory, name);
    if (fs.existsSync(target)) throw new Error(`Refusing to overwrite existing file: ${path.relative(root, target)}`);
  }
  fs.mkdirSync(directory, { recursive: true });
  for (const [name, contents] of Object.entries(files)) fs.writeFileSync(path.join(directory, name), contents, { flag: "wx" });
  process.stdout.write(`Created ${relativeDirectory}/page.json (${id} → ${route}).\n`);
}

try { main(); }
catch (error) { process.stderr.write(`create-page: ${error.message}\n`); process.exitCode = 1; }
