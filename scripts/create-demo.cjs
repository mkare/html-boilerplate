#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const HELP = `Usage: node scripts/create-demo.cjs <demo-id> [options]

Options:
  --title <text>       Demo home title (defaults from id)
  --home-route <path>  Must be / because a demoHome mounts at the package root
  --root <directory>   Project root (default: current directory; useful for fixtures)
  --help               Show this help

Creates a preview-ready one-page demo in src/pages/<demo-id>/. A new demo must
be completed and registered in the manifest before customer-production builds.
Existing demo files and ids are never overwritten.
`;

function parseArgs(argv) {
  const values = { positional: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--help" || key === "-h") return { help: true };
    if (key.startsWith("--")) {
      if (!["--title", "--home-route", "--root"].includes(key)) throw new Error(`Unknown option: ${key}`);
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${key} requires a value.`);
      if (values[key]) throw new Error(`${key} may be specified once.`);
      values[key] = value;
      index += 1;
    } else values.positional.push(key);
  }
  if (values.positional.length > 1) throw new Error("Provide one demo id.");
  return values;
}

function titleFromId(id) {
  return id.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

function scanPageRecords(root) {
  const ids = new Set();
  const pageIds = new Set();
  for (const relativeRoot of ["src/pages", "src/views"]) {
    const directory = path.join(root, relativeRoot);
    if (!fs.existsSync(directory)) continue;
    const visit = (current) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) visit(absolute);
        else if (entry.isFile() && entry.name === "page.json") {
          let record;
          try { record = JSON.parse(fs.readFileSync(absolute, "utf8")); }
          catch (error) { throw new Error(`Cannot inspect ${path.relative(root, absolute)}: ${error.message}`, { cause: error }); }
          if (typeof record.demoId === "string") ids.add(record.demoId.toLowerCase());
          if (typeof record.id === "string") pageIds.add(record.id.normalize("NFC").toLocaleLowerCase("en-US"));
        }
      }
    };
    visit(directory);
  }
  return { ids, pageIds };
}

function assertSafeTarget(root, relativePath) {
  let current = path.resolve(root);
  for (const segment of relativePath.split(path.sep)) {
    current = path.join(current, segment);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error(`Refusing to follow symbolic link in scaffold path: ${path.relative(root, current)}`);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { process.stdout.write(HELP); return; }
  const id = options.positional[0] || "";
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error("Demo id must be lowercase letters/digits with optional hyphens.");
  const homeRoute = options["--home-route"] || "/";
  if (homeRoute !== "/") throw new Error("--home-route must be /; the profile contract mounts demoHome at the selected package root.");
  const title = options["--title"] || `${titleFromId(id)} home`;
  if (!title.trim()) throw new Error("--title cannot be empty.");
  const root = path.resolve(options["--root"] || process.cwd());
  const records = scanPageRecords(root);
  if (records.ids.has(id)) throw new Error(`Demo id already exists: ${id}`);
  const pageId = `${id}.home`;
  if (records.pageIds.has(pageId.normalize("NFC").toLocaleLowerCase("en-US"))) throw new Error(`Page id already exists: ${pageId}`);

  const demoDirectory = path.resolve(root, "src/pages", id);
  if (fs.existsSync(demoDirectory)) throw new Error(`Refusing to write into existing directory: src/pages/${id}`);
  assertSafeTarget(root, path.join("src", "pages", id));
  const relativeDirectory = path.posix.join("src/pages", id, "home");
  const directory = path.resolve(root, relativeDirectory);
  if (!directory.startsWith(`${root}${path.sep}`)) throw new Error("Resolved scaffold path escapes the project root.");
  const files = {
    "page.json": `${JSON.stringify({
      id: pageId,
      route: "/",
      demoId: id,
      demoHome: true,
      starter: true,
      translationKey: pageId,
      source: `${relativeDirectory}/page.pug`,
      styles: [`src/pages/${id}/${id}.scss`],
      layout: "site",
      theme: "default",
      locale: "en",
      direction: "ltr",
      title,
      description: `A static ${titleFromId(id)} demo starter.`,
      navigation: { groups: ["main", "footer"], label: "Home", order: 1 },
    }, null, 2)}\n`,
    "page.pug": `extends @layouts/base.pug\n\nblock head\n  link(href="@pages/${id}/${id}.scss" rel="stylesheet")\n\nblock content\n  section.demo-scaffold(aria-labelledby="demo-title")\n    .container\n      p.demo-scaffold__eyebrow= demoBrand\n      h1#demo-title= title\n      p This is a static starting point. Add pages and keep links inside the selected demo with route(pageId).\n      a.demo-scaffold__link(href=route(pageId)) View this demo home\n`,
  };
  const stylesheet = path.resolve(root, "src/pages", id, `${id}.scss`);
  if (fs.existsSync(stylesheet)) throw new Error(`Refusing to overwrite existing file: ${path.relative(root, stylesheet)}`);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "page.json"), files["page.json"], { flag: "wx" });
  fs.writeFileSync(path.join(directory, "page.pug"), files["page.pug"], { flag: "wx" });
  fs.writeFileSync(stylesheet, `// Demo-owned styles for ${id}.\n.demo-scaffold {\n  padding-block: clamp(4rem, 10vw, 8rem);\n}\n.demo-scaffold__eyebrow {\n  color: var(--color-accent-strong);\n  font-weight: 700;\n}\n`, { flag: "wx" });
  const readmePath = path.resolve(root, "src/pages", id, "README.md");
  fs.writeFileSync(readmePath, `# ${titleFromId(id)} demo scaffold\n\nThis one-page record is included in development and catalog-preview under /demos/${id}/.\n\nBefore building it as a customer package, finish the selected-demo page set and register the id as a complete demo in the root-owned manifest profile contract. The CLI does not edit shared build files.\n`, { flag: "wx" });
  process.stdout.write(`Created preview scaffold ${relativeDirectory}/page.json (${pageId}, route /).\n`);
}

try { main(); }
catch (error) { process.stderr.write(`create-demo: ${error.message}\n`); process.exitCode = 1; }
