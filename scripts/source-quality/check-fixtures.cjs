#!/usr/bin/env node
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "../..");
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "source-quality-fixtures-"));
const configs = [
  "eslint.config.mjs",
  "stylelint.config.mjs",
  ".pug-lintrc.json",
  ".markdownlint-cli2.jsonc",
  ".prettierrc.json",
];

function writeFixture(relativePath, content) {
  const filename = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, content);
  return filename;
}

function digest(filename) {
  return crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex");
}

function run(label, binPath, args) {
  const result = spawnSync(process.execPath, [binPath, ...args], {
    cwd: fixtureRoot,
    encoding: "utf8",
  });
  assert.ifError(result.error);
  return { label, status: result.status, output: `${result.stdout || ""}${result.stderr || ""}` };
}

function expectExit(result, shouldFail) {
  const failed = result.status !== 0;
  if (failed !== shouldFail) {
    throw new Error(
      `${result.label} expected ${shouldFail ? "failure" : "success"}, received exit ${result.status}.\n${result.output.slice(0, 1200)}`,
    );
  }
}

try {
  for (const config of configs) {
    fs.copyFileSync(path.join(repoRoot, config), path.join(fixtureRoot, config));
  }
  fs.symlinkSync(
    path.join(repoRoot, "node_modules"),
    path.join(fixtureRoot, "node_modules"),
    "dir",
  );

  writeFixture(
    "src/clean.js",
    'const node = document.createElement("div");\nnode.textContent = "safe";\n',
  );
  writeFixture("src/unsafe.js", 'document.body.innerHTML = "<p>unsafe</p>";\n');
  const cleanScss = writeFixture("src/clean.scss", "a { color: #000; }\n");
  const badScss = writeFixture("src/unsafe.scss", "a { colorx: #000; }\n");
  const cleanPug = writeFixture("src/clean.pug", "button(type='button') Save\n");
  const badPug = writeFixture("src/duplicate.pug", "button(type='button', type='submit') Save\n");
  const cleanMarkdown = writeFixture("docs/clean.md", "# Clean fixture\n\nReady.\n");
  const badMarkdown = writeFixture("docs/bad.md", "#Missing heading space\n\nBody.\n");
  const cleanFormat = writeFixture("src/format-clean.pug", "div\n  span Ready\n");
  const badFormat = writeFixture("src/format-drift.pug", "div\n    span Needs formatting\n");

  const eslint = path.join(repoRoot, "node_modules/eslint/bin/eslint.js");
  const stylelint = path.join(repoRoot, "node_modules/stylelint/bin/stylelint.mjs");
  const pugLint = path.join(repoRoot, "node_modules/pug-lint/bin/pug-lint");
  const markdownlint = path.join(
    repoRoot,
    "node_modules/markdownlint-cli2/markdownlint-cli2-bin.mjs",
  );
  const prettier = path.join(repoRoot, "node_modules/prettier/bin/prettier.cjs");

  expectExit(
    run("ESLint clean source", eslint, ["--config", "eslint.config.mjs", "src/clean.js"]),
    false,
  );
  expectExit(
    run("ESLint unsafe HTML write", eslint, ["--config", "eslint.config.mjs", "src/unsafe.js"]),
    true,
  );
  expectExit(
    run("Stylelint clean SCSS", stylelint, ["--config", "stylelint.config.mjs", cleanScss]),
    false,
  );
  expectExit(
    run("Stylelint unknown property", stylelint, ["--config", "stylelint.config.mjs", badScss]),
    true,
  );
  expectExit(run("Pug clean template", pugLint, ["--config", ".pug-lintrc.json", cleanPug]), false);
  expectExit(
    run("Pug duplicate attribute", pugLint, ["--config", ".pug-lintrc.json", badPug]),
    true,
  );
  expectExit(
    run("Markdown clean document", markdownlint, [
      "--config",
      ".markdownlint-cli2.jsonc",
      "--no-globs",
      cleanMarkdown,
    ]),
    false,
  );
  expectExit(
    run("Markdown heading violation", markdownlint, [
      "--config",
      ".markdownlint-cli2.jsonc",
      "--no-globs",
      badMarkdown,
    ]),
    true,
  );

  const prettierArgs = [
    "--check",
    "--config",
    ".prettierrc.json",
    "--plugin",
    "@prettier/plugin-pug",
  ];
  expectExit(run("Prettier clean Pug", prettier, [...prettierArgs, cleanFormat]), false);
  const before = digest(badFormat);
  expectExit(run("Prettier format drift", prettier, [...prettierArgs, badFormat]), true);
  assert.equal(digest(badFormat), before, "Prettier check mode must not modify the fixture.");

  process.stdout.write(
    "Source-quality fixtures passed: ESLint, Stylelint, Pug lint, Markdown lint and check-only Prettier detect disposable failures; the format check preserved its input.\n",
  );
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
