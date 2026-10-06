"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const OUTPUT_FORMAT_ORDER = Object.freeze(["avif", "webp", "jpeg", "png"]);
const OUTPUT_OPTIONS = Object.freeze({
  avif: Object.freeze({ quality: 55, effort: 2, chromaSubsampling: "4:2:0" }),
  webp: Object.freeze({ quality: 78, effort: 4, smartSubsample: true }),
  jpeg: Object.freeze({ quality: 82, progressive: true, chromaSubsampling: "4:2:0" }),
  png: Object.freeze({ compressionLevel: 9, adaptiveFiltering: true }),
});
const SOURCE_FORMATS = new Set(["jpeg", "png", "webp", "avif", "tiff", "gif"]);
const EXTENSION_FORMATS = Object.freeze({
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".png": "png",
  ".webp": "webp",
  ".avif": "avif",
  ".tif": "tiff",
  ".tiff": "tiff",
  ".gif": "gif",
});
const OUTPUT_EXTENSIONS = Object.freeze({ jpeg: "jpg", png: "png", avif: "avif", webp: "webp" });

function entryLabel(entry, index) {
  const id = entry && typeof entry === "object" && typeof entry.id === "string" && entry.id.trim()
    ? entry.id.trim()
    : `entry at index ${index}`;
  return `Responsive image entry "${id}"`;
}

function fail(entry, index, message, cause) {
  const error = new Error(`${entryLabel(entry, index)}: ${message}`, cause ? { cause } : undefined);
  throw error;
}

function isWithin(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function resolveRepoSource(source, repoRoot, entry, index) {
  if (typeof source !== "string" || !source.trim()) fail(entry, index, "source must be a non-empty repository-relative path.");
  if (path.isAbsolute(source) || /^[A-Za-z]:[\\/]/.test(source) || source.includes("\\")) {
    fail(entry, index, "source must be a repository-relative path.");
  }
  const segments = source.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    fail(entry, index, "source must not contain empty, current-directory, or traversal segments.");
  }

  const resolved = path.resolve(repoRoot, ...segments);
  if (!isWithin(repoRoot, resolved)) fail(entry, index, "source resolves outside the repository root.");
  if (!fs.existsSync(resolved)) fail(entry, index, `source does not exist: ${source}.`);
  let realRoot;
  let realSource;
  try {
    realRoot = fs.realpathSync(repoRoot);
    realSource = fs.realpathSync(resolved);
  } catch (error) {
    fail(entry, index, `source cannot be resolved: ${source}.`, error);
  }
  if (!isWithin(realRoot, realSource)) fail(entry, index, "source resolves outside the repository root.");
  if (!fs.statSync(realSource).isFile()) fail(entry, index, `source is not a regular file: ${source}.`);

  const extension = path.extname(source).toLowerCase();
  if (!Object.hasOwn(EXTENSION_FORMATS, extension)) {
    fail(entry, index, `source must be a supported raster image; received extension "${extension || "(none)"}".`);
  }

  return { absolute: realSource, extension, declaredFormat: EXTENSION_FORMATS[extension] };
}

function normalizeEntry(entry, index, { repoRoot, seenIds }) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) fail(entry, index, "entry must be an object.");
  const label = entryLabel(entry, index);
  if (typeof entry.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(entry.id)) {
    fail(entry, index, "id must use lowercase letters, digits, and hyphens, starting with a letter or digit.");
  }
  if (typeof entry.owner !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(entry.owner)) {
    fail(entry, index, "owner must be a safe lowercase namespace using letters, digits, and hyphens.");
  }
  if (seenIds.has(entry.id)) {
    fail(entry, index, `id is already used by owner "${seenIds.get(entry.id)}"; image IDs are global map keys and must be unique.`);
  }
  seenIds.set(entry.id, entry.owner);

  const source = resolveRepoSource(entry.source, repoRoot, entry, index);
  if (!Array.isArray(entry.widths) || entry.widths.length === 0) fail(entry, index, "widths must be a non-empty ascending array of positive integers.");
  const widths = [...entry.widths];
  for (let widthIndex = 0; widthIndex < widths.length; widthIndex += 1) {
    const width = widths[widthIndex];
    if (!Number.isSafeInteger(width) || width <= 0) fail(entry, index, "widths must contain only positive safe integers.");
    if (widthIndex > 0 && width <= widths[widthIndex - 1]) fail(entry, index, "widths must be unique and strictly ascending.");
  }

  const requestedFormats = entry.formats === undefined ? ["avif", "webp"] : entry.formats;
  if (!Array.isArray(requestedFormats) || requestedFormats.length === 0) fail(entry, index, "formats must be a non-empty array containing avif and/or webp.");
  if (requestedFormats.some((format) => !["avif", "webp"].includes(format))) {
    fail(entry, index, "formats may contain only avif and webp.");
  }
  if (new Set(requestedFormats).size !== requestedFormats.length) fail(entry, index, "formats must not contain duplicates.");
  const formats = OUTPUT_FORMAT_ORDER.filter((format) => requestedFormats.includes(format));

  let fallback = entry.fallback;
  if (fallback === undefined) {
    if (!["jpeg", "png"].includes(source.declaredFormat)) {
      fail(entry, index, `fallback is required for ${source.declaredFormat} input; only jpeg and png fallbacks are supported.`);
    }
    fallback = source.declaredFormat;
  }
  if (!["jpeg", "png"].includes(fallback)) fail(entry, index, "fallback must be either jpeg or png.");
  if (entry.priority !== undefined && typeof entry.priority !== "boolean") fail(entry, index, "priority must be a boolean when provided.");

  return {
    id: entry.id,
    owner: entry.owner,
    source: entry.source,
    absoluteSource: source.absolute,
    extension: source.extension,
    declaredFormat: source.declaredFormat,
    widths,
    formats,
    fallback,
    priority: entry.priority === true,
    label,
  };
}

function validateResponsiveImageEntries(entries, { repoRoot = process.cwd() } = {}) {
  if (!Array.isArray(entries)) throw new TypeError("Responsive image entries must be an array.");
  const absoluteRoot = path.resolve(repoRoot);
  if (!fs.existsSync(absoluteRoot) || !fs.statSync(absoluteRoot).isDirectory()) {
    throw new Error(`Responsive image repository root does not exist or is not a directory: ${absoluteRoot}`);
  }
  const seenIds = new Map();
  return entries
    .map((entry, index) => normalizeEntry(entry, index, { repoRoot: absoluteRoot, seenIds }))
    .sort((left, right) => left.owner < right.owner ? -1 : left.owner > right.owner ? 1 : left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}

function orientedDimensions(metadata) {
  const width = metadata.width;
  const height = metadata.height;
  const rotate = Number(metadata.orientation) >= 5 && Number(metadata.orientation) <= 8;
  return rotate ? { width: height, height: width } : { width, height };
}

function codecOptions(format) {
  return OUTPUT_OPTIONS[format];
}

function getContentHash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function toCandidateRef(candidate) {
  const { width, height, filename, format, buffer } = candidate;
  return { width, height, filename, format, buffer };
}

async function generateResponsiveImageVariants(entries, { repoRoot = process.cwd(), sharp = require("sharp") } = {}) {
  const normalized = validateResponsiveImageEntries(entries, { repoRoot });
  const images = Object.create(null);
  const assetsByFilename = new Map();

  for (const [index, entry] of normalized.entries()) {
    let metadata;
    try {
      metadata = await sharp(entry.absoluteSource, { failOn: "error", animated: true }).metadata();
    } catch (error) {
      fail({ id: entry.id }, index, `source is malformed or cannot be decoded: ${error.message}`, error);
    }
    if (!SOURCE_FORMATS.has(metadata.format)) {
      fail({ id: entry.id }, index, `source is not a supported raster format (decoded as "${metadata.format || "unknown"}").`);
    }
    if (metadata.format !== entry.declaredFormat) {
      fail({ id: entry.id }, index, `source extension indicates ${entry.declaredFormat}, but image data is ${metadata.format}.`);
    }
    if ((Number(metadata.pages) || 1) > 1 || metadata.animated === true) {
      fail({ id: entry.id }, index, "animated images are not supported; provide a single-frame raster source.");
    }
    if (!Number.isSafeInteger(metadata.width) || metadata.width <= 0 || !Number.isSafeInteger(metadata.height) || metadata.height <= 0) {
      fail({ id: entry.id }, index, "source has invalid intrinsic dimensions.");
    }
    const intrinsic = orientedDimensions(metadata);
    if (!Number.isSafeInteger(intrinsic.width) || !Number.isSafeInteger(intrinsic.height) || intrinsic.width <= 0 || intrinsic.height <= 0) {
      fail({ id: entry.id }, index, "source has invalid orientation-adjusted dimensions.");
    }
    for (const width of entry.widths) {
      if (width > intrinsic.width) fail({ id: entry.id }, index, `requested width ${width}px exceeds intrinsic width ${intrinsic.width}px.`);
    }
    if (!["jpeg", "png"].includes(entry.fallback)) {
      fail({ id: entry.id }, index, `unsupported fallback format "${entry.fallback}".`);
    }

    const formats = Object.create(null);
    const fallbackCandidates = [];
    const outputFormats = OUTPUT_FORMAT_ORDER.filter((format) => entry.formats.includes(format) || format === entry.fallback);

    for (const width of entry.widths) {
      for (const format of outputFormats) {
        let result;
        try {
          result = await sharp(entry.absoluteSource, { failOn: "error" })
            .rotate()
            .resize({ width, fit: "inside", withoutEnlargement: true })
            .toFormat(format, codecOptions(format))
            .toBuffer({ resolveWithObject: true });
        } catch (error) {
          fail({ id: entry.id }, index, `could not encode ${format} at ${width}px: ${error.message}`, error);
        }
        const buffer = Buffer.from(result.data);
        let encodedMetadata;
        try {
          encodedMetadata = await sharp(buffer).metadata();
        } catch (error) {
          fail({ id: entry.id }, index, `encoded ${format} at ${width}px could not be decoded for validation: ${error.message}`, error);
        }
        const actualFormat = encodedMetadata.mediaType === "image/avif" ? "avif" : encodedMetadata.format;
        if (actualFormat !== format) fail({ id: entry.id }, index, `encoder returned ${actualFormat} when ${format} was requested at ${width}px.`);
        if (!Number.isSafeInteger(result.info.width) || !Number.isSafeInteger(result.info.height) || result.info.width > intrinsic.width || result.info.width > width) {
          fail({ id: entry.id }, index, `encoder returned invalid dimensions for ${format} at ${width}px.`);
        }

        const digest = getContentHash(buffer);
        const extension = OUTPUT_EXTENSIONS[format];
        const filename = `assets/images/responsive/${entry.owner}/${entry.id}-${width}.${digest.slice(0, 16)}.${extension}`;
        const prior = assetsByFilename.get(filename);
        if (prior && !prior.buffer.equals(buffer)) {
          fail({ id: entry.id }, index, `output filename collision for ${filename}.`);
        }
        const asset = {
          filename,
          buffer,
          owner: entry.owner,
          id: entry.id,
          source: entry.source,
          width: result.info.width,
          height: result.info.height,
          format,
          sha256: digest,
        };
        if (!prior) assetsByFilename.set(filename, asset);

        const candidate = toCandidateRef(asset);
        if (format === entry.fallback) fallbackCandidates.push(candidate);
        else {
          if (!formats[format]) formats[format] = { type: `image/${format}`, srcset: [] };
          formats[format].srcset.push(candidate);
        }
      }
    }

    const largestFallback = fallbackCandidates[fallbackCandidates.length - 1];
    if (!largestFallback) fail({ id: entry.id }, index, "no fallback candidates were generated.");
    images[entry.id] = {
      id: entry.id,
      owner: entry.owner,
      width: intrinsic.width,
      height: intrinsic.height,
      intrinsicWidth: intrinsic.width,
      intrinsicHeight: intrinsic.height,
      aspectRatio: intrinsic.width / intrinsic.height,
      priority: entry.priority,
      fallback: {
        format: entry.fallback,
        filename: largestFallback.filename,
        srcset: fallbackCandidates,
      },
      formats,
    };
  }

  const assets = [...assetsByFilename.values()].sort((left, right) => left.filename < right.filename ? -1 : left.filename > right.filename ? 1 : 0);
  return { images, assets };
}

module.exports = { validateResponsiveImageEntries, generateResponsiveImageVariants };
