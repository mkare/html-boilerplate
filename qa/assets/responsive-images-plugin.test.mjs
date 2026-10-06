import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const webpack = require("webpack");
const sharp = require("sharp");
const { ResponsiveImagesPlugin } = require("../../build/webpack/responsive-images-plugin.cjs");
const { createAssetUrlHelper } = require("../../build/helpers/urls.cjs");

async function makeFixture(t) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "responsive-images-plugin-"));
  t.after(async () => rm(repoRoot, { recursive: true, force: true }));
  const source = path.join(repoRoot, "src/pages/agency/assets/hero.png");
  await mkdir(path.dirname(source), { recursive: true });
  const pixels = Buffer.alloc(16 * 12 * 3);
  for (let offset = 0; offset < pixels.length; offset += 3) {
    pixels[offset] = 225;
    pixels[offset + 1] = 120;
    pixels[offset + 2] = 35;
  }
  await sharp(pixels, { raw: { width: 16, height: 12, channels: 3 } }).png().toFile(source);

  const manifestPath = path.join(repoRoot, "config/responsive-images.cjs");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `module.exports = {
  entries: [{ id: "agency-home-hero", owner: "agency", source: "src/pages/agency/assets/hero.png", widths: [4, 8, 16], formats: ["avif", "webp"], fallback: "png", priority: true }],
  pages: { "agency.home": ["agency-home-hero"] },
};\n`);
  const entryPath = path.join(repoRoot, "entry.cjs");
  await writeFile(entryPath, "module.exports = 'fixture';\n");
  return { repoRoot, manifestPath, entryPath };
}

async function runWebpack({ repoRoot, manifestPath, entryPath, basePath }) {
  const pageData = { responsiveImages: {} };
  const entryPoints = { "agency.home": { data: pageData } };
  const pages = [{ id: "agency.home", demoId: "agency" }];
  const site = { demoId: "agency", assetBase: basePath };
  const plugin = new ResponsiveImagesPlugin({
    entries: entryPoints,
    pages,
    site,
    assetUrl: createAssetUrlHelper(site),
    manifestPath,
    repoRoot,
  });
  const outputPath = path.join(repoRoot, basePath === "/" ? "out-root" : "out-subpath");
  const compiler = webpack({
    mode: "production",
    context: repoRoot,
    entry: { fixture: entryPath },
    output: { path: outputPath, filename: "assets/js/fixture.js", publicPath: basePath },
    cache: false,
    plugins: [plugin],
  });

  try {
    const stats = await new Promise((resolve, reject) => {
      compiler.run((error, result) => {
        if (error) reject(error);
        else if (result.hasErrors()) reject(new Error(result.toString({ all: false, errors: true })));
        else resolve(result);
      });
    });
    return { outputPath, pageData, plugin, stats };
  } finally {
    await new Promise((resolve, reject) => compiler.close((error) => error ? reject(error) : resolve()));
  }
}

test("Webpack emits responsive variants and page data uses the configured root/subpath asset base", async (t) => {
  const fixture = await makeFixture(t);
  for (const basePath of ["/", "/preview/theme/"]) {
    const { outputPath, pageData, plugin } = await runWebpack({ ...fixture, basePath });
    const image = pageData.responsiveImages["agency-home-hero"];
    const prefix = basePath === "/" ? "" : basePath.replace(/\/$/, "");

    assert.equal(image.owner, "agency");
    assert.equal(image.intrinsicWidth, 16);
    assert.equal(image.intrinsicHeight, 12);
    assert.equal(image.aspectRatio, 4 / 3);
    assert.equal(image.priority, true);
    assert.deepEqual(Object.keys(image.formats), ["avif", "webp"]);
    assert.equal(plugin.generated.assets.length, 9);

    const references = [image.fallback.src, ...image.fallback.candidates.map((candidate) => candidate.src)];
    for (const descriptor of Object.values(image.formats)) {
      assert.deepEqual(descriptor.candidates.map((candidate) => candidate.width), [4, 8, 16]);
      assert.ok(descriptor.srcset.startsWith(`${prefix}/assets/images/responsive/agency/`));
      references.push(...descriptor.candidates.map((candidate) => candidate.src));
      assert.deepEqual(
        descriptor.srcset,
        descriptor.candidates.map((candidate) => `${candidate.src} ${candidate.width}w`).join(", "),
      );
    }
    assert.ok(references.every((reference) => reference.startsWith(`${prefix}/assets/images/responsive/agency/`)));

    for (const asset of plugin.generated.assets) {
      const emitted = await readFile(path.join(outputPath, ...asset.filename.split("/")));
      assert.deepEqual(emitted, asset.buffer, `${asset.filename} must be emitted byte-for-byte`);
    }
  }
});
