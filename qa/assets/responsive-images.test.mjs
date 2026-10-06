import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const pug = require("pug");
const { validateResponsiveImageEntries, generateResponsiveImageVariants } = require("../../build/assets/responsive-images.cjs");

const componentPath = path.resolve("src/blocks/media/responsive-picture.pug");
const componentSource = await readFile(componentPath, "utf8");

async function makeRepo(t) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "responsive-images-test-"));
  t.after(async () => rm(repoRoot, { recursive: true, force: true }));
  return repoRoot;
}

async function writeRaster(repoRoot, relative, { width, height, color }) {
  const filename = path.join(repoRoot, ...relative.split("/"));
  await mkdir(path.dirname(filename), { recursive: true });
  const pixels = Buffer.alloc(width * height * 3);
  for (let offset = 0; offset < pixels.length; offset += 3) {
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
  }
  await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toFile(filename);
  return filename;
}

async function listFiles(directory, relative = "") {
  const names = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const item of names) {
    const child = relative ? `${relative}/${item.name}` : item.name;
    if (item.isDirectory()) files.push(...await listFiles(path.join(directory, item.name), child));
    else files.push(child);
  }
  return files.sort();
}

function candidatesFor(image) {
  return [
    ...Object.values(image.formats).flatMap((descriptor) => descriptor.srcset),
    ...image.fallback.srcset,
  ];
}

test("generates owner-qualified, content-hashed AVIF/WebP/fallback candidates deterministically", async (t) => {
  const repoRoot = await makeRepo(t);
  await writeRaster(repoRoot, "src/agency/hero.png", { width: 12, height: 8, color: [240, 40, 30] });
  await writeRaster(repoRoot, "src/saas/hero.png", { width: 10, height: 10, color: [20, 60, 230] });
  const entries = [
    { id: "saas-home-hero", owner: "saas", source: "src/saas/hero.png", widths: [4, 8, 10], priority: false },
    { id: "agency-home-hero", owner: "agency", source: "src/agency/hero.png", widths: [4, 8, 12], priority: true },
  ];
  const before = await listFiles(repoRoot);
  const first = await generateResponsiveImageVariants(entries, { repoRoot });
  const afterFirst = await listFiles(repoRoot);
  const second = await generateResponsiveImageVariants(entries, { repoRoot });
  const afterSecond = await listFiles(repoRoot);

  assert.deepEqual(afterFirst, before, "generation must return buffers without writing files");
  assert.deepEqual(afterSecond, before, "repeat generation must not create build outputs in the fixture root");
  assert.deepEqual(Object.keys(first.images), ["agency-home-hero", "saas-home-hero"]);
  assert.equal(first.images["agency-home-hero"].owner, "agency");
  assert.equal(first.images["agency-home-hero"].intrinsicWidth, 12);
  assert.equal(first.images["agency-home-hero"].intrinsicHeight, 8);
  assert.equal(first.images["agency-home-hero"].aspectRatio, 1.5);
  assert.equal(first.images["agency-home-hero"].priority, true);
  assert.equal(first.images["agency-home-hero"].fallback.format, "png");
  assert.equal(first.images["saas-home-hero"].aspectRatio, 1);
  assert.equal(first.assets.length, 18, "two entries × three widths × AVIF/WebP/PNG fallback");

  const outputNames = first.assets.map((asset) => asset.filename);
  assert.equal(new Set(outputNames).size, outputNames.length);
  assert.ok(outputNames.some((name) => name.includes("/agency/agency-home-hero-4.") && name.endsWith(".png")));
  assert.ok(outputNames.some((name) => name.includes("/saas/saas-home-hero-4.") && name.endsWith(".png")));
  for (const asset of first.assets) {
    assert.match(asset.filename, /^assets\/images\/responsive\/(agency|saas)\/[a-z0-9-]+-\d+\.[a-f0-9]{16}\.(avif|webp|jpg|png)$/);
    assert.equal(asset.sha256, createHash("sha256").update(asset.buffer).digest("hex"));
    assert.ok(asset.filename.includes(asset.sha256.slice(0, 16)), "filename hash must derive from encoded bytes");
    const decoded = await sharp(asset.buffer).metadata();
    assert.equal(decoded.mediaType === "image/avif" ? "avif" : decoded.format, asset.format);
    assert.equal(decoded.width, asset.width);
    assert.equal(decoded.height, asset.height);
    assert.ok(asset.width <= 12, "encoded output must never be enlarged past source width");
  }

  const candidateWidths = candidatesFor(first.images["agency-home-hero"]).map((candidate) => candidate.width);
  assert.deepEqual(candidateWidths, [4, 8, 12, 4, 8, 12, 4, 8, 12]);
  assert.deepEqual(
    first.assets.map(({ filename, sha256 }) => ({ filename, sha256 })),
    second.assets.map(({ filename, sha256 }) => ({ filename, sha256 })),
    "same input and codec options must produce identical asset names and hashes",
  );
});

test("validates entry shape, paths, IDs, formats, fallback, and dimensions", async (t) => {
  const repoRoot = await makeRepo(t);
  await writeRaster(repoRoot, "src/images/hero.png", { width: 8, height: 4, color: [90, 120, 160] });
  const valid = { id: "home-hero", owner: "agency", source: "src/images/hero.png", widths: [4, 8] };

  assert.equal(validateResponsiveImageEntries([valid], { repoRoot })[0].fallback, "png");
  assert.throws(() => validateResponsiveImageEntries([{ ...valid, source: "../outside.png" }], { repoRoot }), /home-hero.*traversal/);
  assert.throws(() => validateResponsiveImageEntries([{ ...valid, source: "src/images/missing.png" }], { repoRoot }), /home-hero.*does not exist/);
  assert.throws(() => validateResponsiveImageEntries([
    valid,
    { ...valid, owner: "saas", source: "src/images/hero.png" },
  ], { repoRoot }), /home-hero.*already used by owner/);
  assert.throws(() => validateResponsiveImageEntries([{ ...valid, widths: [8, 4] }], { repoRoot }), /home-hero.*strictly ascending/);
  assert.throws(() => validateResponsiveImageEntries([{ ...valid, formats: ["jpeg"] }], { repoRoot }), /home-hero.*only avif and webp/);
  assert.throws(() => validateResponsiveImageEntries([{ ...valid, fallback: "webp" }], { repoRoot }), /home-hero.*fallback must be either jpeg or png/);
  await assert.rejects(
    generateResponsiveImageVariants([{ ...valid, widths: [4, 9] }], { repoRoot }),
    /home-hero.*exceeds intrinsic width 8px/,
  );
});

test("rejects malformed, non-raster, mismatched, and animated sources with entry IDs", async (t) => {
  const repoRoot = await makeRepo(t);
  await mkdir(path.join(repoRoot, "src/images"), { recursive: true });
  await writeFile(path.join(repoRoot, "src/images/broken.png"), Buffer.from("not a PNG"));
  await writeFile(path.join(repoRoot, "src/images/not-an-image.svg"), Buffer.from("<svg/>"));
  await writeFile(path.join(repoRoot, "src/images/animated.gif"), Buffer.from("GIF89a"));
  const base = { owner: "agency", widths: [1] };

  assert.throws(() => validateResponsiveImageEntries([
    { ...base, id: "svg-input", source: "src/images/not-an-image.svg" },
  ], { repoRoot }), /svg-input.*supported raster image/);
  await assert.rejects(
    generateResponsiveImageVariants([{ ...base, id: "broken-source", source: "src/images/broken.png" }], { repoRoot }),
    /broken-source.*malformed or cannot be decoded/,
  );
  await assert.rejects(
    generateResponsiveImageVariants([{ ...base, id: "animated-source", source: "src/images/animated.gif", fallback: "png" }], {
      repoRoot,
      sharp: () => ({ metadata: async () => ({ format: "gif", width: 2, height: 1, pages: 2 }) }),
    }),
    /animated-source.*animated images are not supported/,
  );
});

function renderResponsivePicture(image, options) {
  return pug.render(`${componentSource}\n+responsivePicture(image, options)\n`, {
    filename: componentPath,
    image,
    options,
  });
}

function findElements(node, tagName, found = []) {
  if (node.tagName === tagName) found.push(node);
  for (const child of node.childNodes || []) findElements(child, tagName, found);
  return found;
}

function attributes(node) {
  return Object.fromEntries((node.attrs || []).map(({ name, value }) => [name, value]));
}

function resolvedImageRecord({ priority }) {
  const candidates = (format) => [320, 640].map((width) => ({
    width,
    src: `/preview/theme/assets/images/responsive/agency/hero-${width}.${format}.hash.${format === "jpeg" ? "jpg" : format}`,
  }));
  return {
    owner: "agency",
    width: 1200,
    height: 800,
    intrinsicWidth: 1200,
    intrinsicHeight: 800,
    aspectRatio: 1.5,
    priority,
    fallback: { format: "jpeg", src: candidates("jpeg")[1].src, srcset: candidates("jpeg") },
    formats: {
      avif: { type: "image/avif", srcset: candidates("avif") },
      webp: { type: "image/webp", srcset: candidates("webp") },
    },
  };
}

test("Pug mixin renders picture sources, responsive fallback, intrinsic size, alt, and priority policy", () => {
  const options = { sizes: "(max-width: 40rem) 100vw, 50vw", alt: "Studio team beside a sunlit window", className: "hero-media" };
  const priorityHtml = renderResponsivePicture(resolvedImageRecord({ priority: true }), options);
  const parse5 = require("parse5");
  const picture = findElements(parse5.parse(priorityHtml), "picture")[0];
  const sourceAttrs = (picture.childNodes || []).filter((node) => node.tagName === "source").map(attributes);
  const imageAttrs = attributes(findElements(picture, "img")[0]);

  assert.deepEqual(sourceAttrs.map((item) => item.type), ["image/avif", "image/webp"]);
  assert.ok(sourceAttrs.every((item) => item.sizes === options.sizes && item.srcset.includes("320w") && item.srcset.includes("640w")));
  assert.equal(picture.attrs.find((item) => item.name === "class").value, "hero-media");
  assert.equal(imageAttrs.width, "1200");
  assert.equal(imageAttrs.height, "800");
  assert.equal(imageAttrs.sizes, options.sizes);
  assert.equal(imageAttrs.alt, options.alt);
  assert.equal(imageAttrs.loading, "eager");
  assert.equal(imageAttrs.fetchpriority, "high");
  assert.ok(imageAttrs.srcset.includes("320w") && imageAttrs.srcset.includes("640w"));

  const lazyHtml = renderResponsivePicture(resolvedImageRecord({ priority: false }), options);
  const lazyImg = attributes(findElements(parse5.parse(lazyHtml), "img")[0]);
  assert.equal(lazyImg.loading, "lazy");
  assert.equal(lazyImg.fetchpriority, undefined);
  assert.throws(() => renderResponsivePicture(resolvedImageRecord({ priority: false }), { ...options, sizes: " " }), /non-empty sizes/);
  assert.throws(() => renderResponsivePicture(resolvedImageRecord({ priority: false }), { ...options, alt: undefined }), /alt string/);
});
