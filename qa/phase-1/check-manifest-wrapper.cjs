#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const parse5 = require("parse5");
const { mergePageData, LAYER_ORDER } = require("../../build/pages/data.cjs");
const {
  GENERATED_MANIFEST,
  KNOWN_LAYOUTS,
  KNOWN_THEMES,
  REPO_ROOT,
  generatePageWrappers,
  loadPages,
  registerOutput,
  toOutputPath,
  validateRecord,
} = require("../../build/pages/manifest.cjs");
const { createPageAssertProps, createWebpackConfig } = require("../../webpack.config.js");

const buildNow = "2026-10-04T00:00:00.000Z";
const site = {
  siteUrl: "https://wrapper-qa.example",
  basePath: "/",
  assetBase: "/",
  demoId: "saas",
  projectOverrides: { pageRecords: [], navigation: null },
};

function readManifest() {
  const { pages } = loadPages({ buildNow, site, profile: "catalog-preview" });
  return { pages, wrappers: generatePageWrappers(pages) };
}

function checkSchema() {
  const base = {
    id: "qa.schema",
    route: "/qa-schema/",
    source: "build/pages/404.pug",
    title: "Schema fixture",
    locale: "en",
  };
  assert.deepEqual(
    [...KNOWN_LAYOUTS],
    ["site", "auth", "dashboard", "storefront", "docs", "minimal", "agency", "legacy"],
  );
  assert.deepEqual([...KNOWN_THEMES], ["default", "commerce"]);
  assert.throws(() => validateRecord({ ...base, layout: "missing" }), /layout.*one of/);
  assert.throws(() => validateRecord({ ...base, theme: "missing" }), /theme.*one of/);
  assert.throws(
    () => validateRecord({ ...base, source: "build/pages/missing-fixture.pug" }),
    /source does not exist/,
  );
  const outputs = new Map();
  registerOutput(outputs, toOutputPath("/Case-Only/"), "page qa.case-upper");
  assert.throws(
    () => registerOutput(outputs, toOutputPath("/case-only/"), "page qa.case-lower"),
    /Output collision/,
  );
  assert.throws(
    () => validateRecord({ ...base, head: { canonical: "self", inlineScript: true } }),
    /head\.inlineScript/,
  );
  assert.throws(
    () => validateRecord({ ...base, navigation: { order: "first" } }),
    /navigation\.order.*number/,
  );
  assert.throws(
    () =>
      validateRecord({
        ...base,
        collection: {
          type: "blog",
          data: "src/content/blog/posts.cjs",
          baseRoute: "/blog/",
          archiveTemplateId: "blog.archive",
          archiveNextTemplateId: "blog.archive.page2",
          categoryTemplateId: "blog.category.design",
          articleTemplateId: "blog.article.tokens-guide",
          ownedIdPrefixes: ["blog."],
          pageSize: "two",
        },
      }),
    /collection\.pageSize.*integer/,
  );
  assert.doesNotThrow(() =>
    validateRecord({
      ...base,
      head: {
        preload: [
          {
            href: "src/assets/fonts/Inter-Latin.woff2",
            as: "font",
            type: "font/woff2",
            crossorigin: "anonymous",
          },
        ],
      },
    }),
  );
}

function checkDataPriority() {
  assert.deepEqual(LAYER_ORDER, ["site", "theme", "demo", "page", "content", "custom"]);
  const merged = mergePageData({
    site: { label: "site", nested: { color: "blue", keep: true }, list: ["site"] },
    theme: { label: "theme", nested: { color: "teal" } },
    demo: { label: "demo" },
    page: { label: "page" },
    content: { label: "content", nested: { title: "content title" }, list: ["content"] },
    custom: { label: "custom" },
  });
  assert.equal(merged.label, "custom");
  assert.deepEqual({ ...merged.nested }, { color: "teal", keep: true, title: "content title" });
  assert.deepEqual(merged.list, ["content"]);
  assert.throws(() => mergePageData({ custom: [] }), /custom.*plain object/);
}

function checkInvalidVariantContext() {
  const assertPageProps = createPageAssertProps({
    id: "qa.variant.page",
    source: "src/pages/qa/variant/page.pug",
  });
  assert.throws(
    () =>
      assertPageProps(
        "ui-button",
        { label: "Continue", variant: "unregistered" },
        {
          properties: {
            label: { type: "string" },
            variant: { type: "string", enum: ["primary", "secondary"] },
          },
          required: ["label"],
          additionalProperties: false,
        },
      ),
    /ui-button.*qa\.variant\.page @ src\/pages\/qa\/variant\/page\.pug.*variant/,
  );
}

function checkWrappers(pages, wrappers) {
  assert.ok(
    pages.some((page) => page.id === "legacy.dashboard"),
    "catalog-preview must include the dashboard compatibility entry",
  );
  const sourcePages = pages.filter(
    (page) => page.source.startsWith("src/pages/") && !page.collection,
  );
  assert.ok(sourcePages.length > 0);
  for (const page of sourcePages) {
    const absoluteSource = path.resolve(REPO_ROOT, page.source);
    const source = fs.readFileSync(absoluteSource, "utf8");
    assert.doesNotMatch(
      source,
      /^extends\s+|^block (?:head|content)\s*$/m,
      `${page.source} must remain a content fragment`,
    );
    assert.doesNotMatch(
      source,
      /rel=["']stylesheet["']|^\s*script\(src=/m,
      `${page.source} must not duplicate manifest-owned styles or scripts`,
    );
    const wrapperPath = wrappers.get(page.id);
    assert.ok(wrapperPath, `${page.id} must have a generated wrapper`);
    const wrapper = fs.readFileSync(wrapperPath, "utf8");
    assert.match(wrapper, new RegExp(`^extends @layouts/${page.layout}\\.pug$`, "m"));
    const sourceAlias = `@pages/${page.source.slice("src/pages/".length)}`;
    assert.ok(
      wrapper.includes(`include ${sourceAlias}`),
      `${page.id} wrapper must include its content fragment through an alias`,
    );
    assert.doesNotMatch(wrapper, /(?:href|src)=["']src\//);
    for (const style of page.styles || [])
      assert.ok(
        wrapper.includes(`@pages/${style.slice("src/pages/".length)}`),
        `${page.id} owns ${style} through its wrapper`,
      );
    if (page.script)
      assert.ok(
        wrapper.includes(
          `@${page.script.startsWith("src/views/") ? "views" : "pages"}/${page.script.replace(/^src\/(?:views|pages)\//, "")}`,
        ),
        `${page.id} owns ${page.script} through its wrapper`,
      );
  }
  const dashboard = pages.find((page) => page.id === "legacy.dashboard");
  assert.equal(wrappers.has(dashboard.id), false, "legacy Pug entries stay direct Webpack entries");
  const dashboardSource = fs.readFileSync(path.resolve(REPO_ROOT, dashboard.source), "utf8");
  assert.match(dashboardSource, /^extends @layouts\/base\.pug/m);
  assert.ok(
    wrappers.size >= sourcePages.length,
    "generated collection instances may reuse a page source with their own wrapper",
  );
}

function walkHtmlNodes(root, found = []) {
  if (root.tagName) found.push(root);
  for (const child of root.childNodes || []) walkHtmlNodes(child, found);
  if (root.content) walkHtmlNodes(root.content, found);
  return found;
}

function checkBuiltPreview(pages) {
  const manifest = JSON.parse(fs.readFileSync(GENERATED_MANIFEST, "utf8"));
  assert.equal(manifest.profile, "catalog-preview");
  assert.ok(
    manifest.pages.some((page) => page.id === "legacy.dashboard"),
    "built preview manifest must include the dashboard",
  );
  const distRoot = path.join(REPO_ROOT, "dist");
  for (const page of pages) {
    const htmlPath = path.join(distRoot, ...page.output.split("/"));
    assert.ok(fs.existsSync(htmlPath), `${page.id} output is missing: ${page.output}`);
    const html = fs.readFileSync(htmlPath, "utf8");
    const nodes = walkHtmlNodes(parse5.parse(html));
    const scripts = nodes
      .filter((node) => node.tagName === "script")
      .map((node) => (node.attrs || []).find((attribute) => attribute.name === "src")?.value)
      .filter(Boolean);
    if (scripts.length > 1) {
      assert.match(
        path.basename(scripts[0]),
        /^runtime\.[a-f0-9]+\.js$/,
        `${page.id} runtime must load before shell/page bundles`,
      );
      assert.equal(
        scripts.filter((source) => /(?:^|\/)runtime\.[a-f0-9]+\.js$/.test(source)).length,
        1,
        `${page.id} must have one runtime script`,
      );
      assert.equal(
        new Set(scripts).size,
        scripts.length,
        `${page.id} must not repeat an external script`,
      );
    }
  }
}

function main() {
  checkSchema();
  checkDataPriority();
  checkInvalidVariantContext();
  const { pages, wrappers } = readManifest();
  checkWrappers(pages, wrappers);
  const config = createWebpackConfig(
    { profile: "catalog-preview", buildNow, demo: "saas" },
    { mode: "production" },
  );
  assert.equal(config.optimization.runtimeChunk, "single", "ADR-001 runtime policy remains active");
  if (process.argv.includes("--built")) checkBuiltPreview(pages);
  process.stdout.write(
    `Phase 1 manifest/wrapper contracts passed: ${pages.length} catalog pages (${wrappers.size} generated wrappers), schema recursion/source existence/case-insensitive output collisions, data precedence, legacy dashboard compatibility${process.argv.includes("--built") ? ", built HTML/runtime ordering" : ""}.\n`,
  );
}

main();
