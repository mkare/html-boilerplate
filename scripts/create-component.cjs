#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const HELP = `Usage: node scripts/create-component.cjs <name> [options]

Options:
  --layer <atoms|molecules|organisms>  Component layer (default: molecules)
  --root <directory>                   Project root (default: current directory)
  --help                                Show this help

Creates a documented Pug + SCSS component under src/ui/<layer>/<name>/.
Existing directories are never overwritten. Static scaffolds do not add JS.
`;

function parseArgs(argv) {
  const values = { positional: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--help" || key === "-h") return { help: true };
    if (key.startsWith("--")) {
      if (!["--layer", "--root"].includes(key)) throw new Error(`Unknown option: ${key}`);
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${key} requires a value.`);
      if (values[key]) throw new Error(`${key} may be specified once.`);
      values[key] = value;
      index += 1;
    } else values.positional.push(key);
  }
  if (values.positional.length > 1) throw new Error("Provide one component name.");
  return values;
}

function pascalCase(name) {
  return name.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("");
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
  const name = options.positional[0] || "";
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error("Component name must be lowercase kebab-case and start with a letter.");
  }
  const layer = options["--layer"] || "molecules";
  if (!new Set(["atoms", "molecules", "organisms"]).has(layer)) throw new Error("--layer must be atoms, molecules, or organisms.");
  const root = path.resolve(options["--root"] || process.cwd());
  const relativeDirectory = path.posix.join("src/ui", layer, name);
  const directory = path.resolve(root, relativeDirectory);
  if (!directory.startsWith(`${root}${path.sep}`)) throw new Error("Resolved scaffold path escapes the project root.");
  assertSafeTarget(root, path.join("src", "ui", layer, name));
  if (fs.existsSync(directory)) throw new Error(`Refusing to overwrite existing directory: ${relativeDirectory}`);

  const mixinName = `ui${pascalCase(name)}`;
  const files = {
    [`${name}.pug`]: `mixin ${mixinName}(options = {})\n  - const props = assertProps('ui-${name}', options, { type: 'object', required: ['label'], properties: { label: { type: 'string', minLength: 1 } }, additionalProperties: false })\n  span.ui-${name}= props.label\n`,
    [`${name}.scss`]: `.ui-${name} {\n  /* Component-owned styles. Prefer semantic theme tokens. */\n}\n`,
    [`${name}.docs.md`]: `# ${name}\n\nPurpose: describe the shared ${name} component and its semantic HTML contract.\n\n## Pug API\n\n\`+${mixinName}({ label })\` requires a non-empty escaped label. Invalid props fail through \`assertProps\`.\n\n## Styling and behavior\n\nThe component owns \`.ui-${name}\` selectors in \`${name}.scss\`. This static scaffold has no JavaScript lifecycle or DOM IDs. Add JS only when there is real interactive behavior, with an idempotent \`mount(root)\` and cleanup method.\n`,
  };
  for (const [filename] of Object.entries(files)) {
    const target = path.join(directory, filename);
    if (fs.existsSync(target)) throw new Error(`Refusing to overwrite existing file: ${path.relative(root, target)}`);
  }
  fs.mkdirSync(directory, { recursive: true });
  for (const [filename, contents] of Object.entries(files)) fs.writeFileSync(path.join(directory, filename), contents, { flag: "wx" });
  process.stdout.write(`Created ${relativeDirectory}/ (${mixinName}).\n`);
}

try { main(); }
catch (error) { process.stderr.write(`create-component: ${error.message}\n`); process.exitCode = 1; }
