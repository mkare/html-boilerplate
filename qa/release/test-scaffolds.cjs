#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const pug = require("pug");
const sass = require("sass");
const { assertProps } = require("../../build/helpers/assert-props.cjs");
const { validateSchemaSubset } = require("../../build/pages/manifest.cjs");

const repoRoot = path.resolve(__dirname, "../..");
const node = process.execPath;

function runFixture(script, args) {
  return spawnSync(node, [path.join(fixture, script), ...args], {
    cwd: fixture,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
}

function copyBuildInputs() {
  for (const directory of ["build", "config", "public", "src"]) {
    fs.cpSync(path.join(repoRoot, directory), path.join(fixture, directory), { recursive: true });
  }
  fs.copyFileSync(path.join(repoRoot, "webpack.config.js"), path.join(fixture, "webpack.config.js"));
  fs.mkdirSync(path.join(fixture, "scripts"), { recursive: true });
  for (const script of ["create-page.cjs", "create-component.cjs", "create-demo.cjs"]) {
    fs.copyFileSync(path.join(repoRoot, "scripts", script), path.join(fixture, "scripts", script));
  }
  fs.symlinkSync(path.join(repoRoot, "node_modules"), path.join(fixture, "node_modules"), "dir");
}

function runProductionBuild() {
  return spawnSync(node, [
    path.join(fixture, "node_modules/webpack-cli/bin/cli.js"),
    "build",
    "--mode",
    "production",
    "--env",
    "profile=catalog-preview",
  ], {
    cwd: fixture,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, BUILD_NOW: "2026-10-03T12:00:00.000Z" },
  });
}

function mustSucceed(result, label) {
  assert.equal(result.status, 0, `${label} should succeed\n${result.stdout}\n${result.stderr}`);
}

function mustFail(result, pattern, label) {
  assert.notEqual(result.status, 0, `${label} should fail`);
  assert.match(result.stderr, pattern, `${label} should explain failure`);
}

function compilePage(filename, localData = {}) {
  const source = fs.readFileSync(filename, "utf8").replace(/^extends @layouts\/base\.pug\s*$/m, "");
  return pug.render(source, { filename, assertProps, ...localData });
}

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "theme-cli-fixture-"));
try {
  copyBuildInputs();

  for (const script of ["create-page.cjs", "create-component.cjs", "create-demo.cjs"]) {
    const help = runFixture(`scripts/${script}`, ["--help"]);
    mustSucceed(help, `${script} help`);
    assert.match(help.stdout, /Usage:/);
  }

  const pageArgs = ["--id", "help.center", "--route", "/help/", "--title", "Help center", "--root", fixture];
  mustSucceed(runFixture("scripts/create-page.cjs", pageArgs), "valid page scaffold");
  const pageDir = path.join(fixture, "src/pages/custom/help-center");
  const pageRecord = JSON.parse(fs.readFileSync(path.join(pageDir, "page.json"), "utf8"));
  assert.equal(pageRecord.id, "help.center");
  assert.equal(pageRecord.route, "/help/");
  validateSchemaSubset(pageRecord, "fixture/src/pages/custom/help-center/page.json");
  const pageHtml = compilePage(path.join(pageDir, "page.pug"), {
    title: pageRecord.title,
    siteUrl: "https://example.test",
    route: () => "/help/",
    pageId: pageRecord.id,
  });
  assert.match(pageHtml, /<h1 id="custom-page-title">Help center<\/h1>/);
  sass.compile(path.join(pageDir, "page.scss"));

  mustFail(runFixture("scripts/create-page.cjs", ["--id", "invalid", "--route", "/missing", "--root", fixture]), /canonical root-relative route/, "page route validation");
  mustFail(runFixture("scripts/create-page.cjs", ["--id", "bad-layout", "--route", "/bad-layout/", "--layout", "missing", "--root", fixture]), /currently declared layout/, "layout validation");
  mustFail(runFixture("scripts/create-page.cjs", ["--id", "bad-theme", "--route", "/bad-theme/", "--theme", "missing", "--root", fixture]), /currently declared theme/, "theme validation");
  mustFail(runFixture("scripts/create-page.cjs", pageArgs), /Page id already exists/, "duplicate page refusal");
  mustFail(runFixture("scripts/create-page.cjs", ["--id", "another.page", "--route", "/help/", "--root", fixture]), /Route already exists in a page record/, "duplicate route refusal");
  fs.mkdirSync(path.join(fixture, "src/pages/custom/protected"), { recursive: true });
  mustFail(runFixture("scripts/create-page.cjs", ["--id", "protected", "--route", "/protected/", "--root", fixture]), /Refusing to write into existing directory/, "page overwrite protection");

  mustSucceed(runFixture("scripts/create-component.cjs", ["status-chip", "--layer", "atoms", "--root", fixture]), "valid component scaffold");
  const componentDir = path.join(fixture, "src/ui/atoms/status-chip");
  const componentTemplate = fs.readFileSync(path.join(componentDir, "status-chip.pug"), "utf8") + "\n+uiStatusChip({ label: 'Ready' })\n";
  assert.match(pug.render(componentTemplate, { filename: path.join(componentDir, "status-chip.pug"), assertProps }), /class="ui-status-chip">Ready<\/span>/);
  sass.compile(path.join(componentDir, "status-chip.scss"));
  assert.ok(fs.existsSync(path.join(componentDir, "status-chip.docs.md")));

  // Use the same page id/source context supplied to assertProps during page builds.
  const assertPropsForPage = (componentName, props, schema) => assertProps(componentName, props, schema, {
    pageId: pageRecord.id,
    source: pageRecord.source,
  });

  // Render a generated component in the generated page context, then prove invalid props fail usefully.
  const contextualPageTemplate = `${fs.readFileSync(path.join(componentDir, "status-chip.pug"), "utf8")}\n+uiStatusChip({ label: 'Ready' })\n`;
  const validSharedComponentHtml = pug.render(contextualPageTemplate, {
    filename: path.join(fixture, "shared-component.pug"),
    assertProps: assertPropsForPage,
  });
  assert.match(validSharedComponentHtml, /class="ui-status-chip">Ready<\/span>/);

  const invalidComponentProps = pug.render.bind(null, `${fs.readFileSync(path.join(componentDir, "status-chip.pug"), "utf8")}\n+uiStatusChip({ label: 'Ready', variant: 'warning' })\n`, {
    filename: path.join(fixture, "invalid-component-props.pug"),
    assertProps: assertPropsForPage,
  });
  assert.throws(invalidComponentProps, (error) => {
    assert.match(error.message, /Invalid props for ui-status-chip \(help\.center @ src\/pages\/custom\/help-center\/page\.pug\): unknown prop "variant"/);
    return true;
  }, "a generated component must reject unsupported props with page and source context");

  const buttonTemplate = `${fs.readFileSync(path.join(repoRoot, "src/ui/atoms/button/button.pug"), "utf8")}\n+uiButton({ label: 'Save', variant: 'neon' })\n`;
  assert.throws(() => pug.render(buttonTemplate, {
    filename: path.join(fixture, "invalid-button-variant.pug"),
    assertProps: assertPropsForPage,
  }), (error) => {
    assert.match(error.message, /Invalid props for ui-button \(help\.center @ src\/pages\/custom\/help-center\/page\.pug\): prop "variant" must be one of: primary, secondary, ghost, danger/);
    return true;
  }, "an invalid shared component variant must fail with useful page/source context");

  const pagePugPath = path.join(pageDir, "page.pug");
  const generatedPageSource = fs.readFileSync(pagePugPath, "utf8");
  const pageWithGeneratedComponent = generatedPageSource
    .replace("extends @layouts/base.pug\n", "extends @layouts/base.pug\n\ninclude @ui/atoms/status-chip/status-chip.pug\n")
    .replace("      p Replace this copy with page content. Use route(\"page.id\") for internal links.\n", "      p Replace this copy with page content. Use route(\"page.id\") for internal links.\n      +uiStatusChip({ label: 'Build ready' })\n");
  assert.notEqual(pageWithGeneratedComponent, generatedPageSource, "the generated component should be included by the generated page fixture");
  fs.writeFileSync(pagePugPath, pageWithGeneratedComponent);

  mustFail(runFixture("scripts/create-component.cjs", ["StatusChip", "--root", fixture]), /lowercase kebab-case/, "component name validation");
  mustFail(runFixture("scripts/create-component.cjs", ["status-chip", "--layer", "atoms", "--root", fixture]), /Refusing to overwrite existing directory/, "component overwrite protection");

  mustSucceed(runFixture("scripts/create-demo.cjs", ["field-notes", "--title", "Field Notes", "--root", fixture]), "valid demo scaffold");
  const demoDir = path.join(fixture, "src/pages/field-notes/home");
  const demoRecord = JSON.parse(fs.readFileSync(path.join(demoDir, "page.json"), "utf8"));
  assert.equal(demoRecord.demoHome, true);
  assert.equal(demoRecord.route, "/");
  assert.match(compilePage(path.join(demoDir, "page.pug"), { title: demoRecord.title, demoBrand: "Field Notes", route: () => "/demos/field-notes/", pageId: demoRecord.id }), /href="\/demos\/field-notes\/"/);
  sass.compile(path.join(fixture, "src/pages/field-notes/field-notes.scss"));
  mustFail(runFixture("scripts/create-page.cjs", ["--id", "root.page", "--route", "/", "--root", fixture]), /Route already exists in a page record/, "demo home route collision refusal");
  mustFail(runFixture("scripts/create-demo.cjs", ["Bad_ID", "--root", fixture]), /lowercase letters\/digits/, "demo id validation");
  mustFail(runFixture("scripts/create-demo.cjs", ["another-demo", "--home-route", "/home/", "--root", fixture]), new RegExp("must be /"), "demo home route validation");
  mustFail(runFixture("scripts/create-demo.cjs", ["field-notes", "--root", fixture]), /Demo id already exists/, "duplicate demo refusal");

  const build = runProductionBuild();
  mustSucceed(build, "isolated catalog-preview Webpack production build");
  const builtPagePath = path.join(fixture, "dist/help/index.html");
  assert.ok(fs.existsSync(builtPagePath), "the generated /help/ page should be emitted by the real production-mode preview build");
  const builtPageHtml = fs.readFileSync(builtPagePath, "utf8");
  assert.match(builtPageHtml, /<h1 id="custom-page-title">Help center<\/h1>/);
  assert.match(builtPageHtml, /<span class="ui-status-chip">Build ready<\/span>/, "the built generated page should render the generated component through page assertProps locals");
  const builtManifest = JSON.parse(fs.readFileSync(path.join(fixture, ".generated/pages-manifest.json"), "utf8"));
  assert.ok(builtManifest.pages.some((page) => page.id === pageRecord.id && page.output === "help/index.html"), "the preview manifest should discover the generated page record and output");

  process.stdout.write("CLI scaffold checks passed: help, valid page/component Pug and SCSS, page-manifest schema and Webpack discovery/emission, generated component rendering through assertProps, contextual invalid prop/variant failures, ID/route validation, duplicate refusal, and overwrite protection.\n");
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
