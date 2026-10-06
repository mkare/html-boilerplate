'use strict';

const path = require('node:path');
const { RawSource } = require('webpack').sources;
const {
  validateResponsiveImageEntries,
  generateResponsiveImageVariants,
} = require('../assets/responsive-images.cjs');

function createPictureImage(image, assetUrl) {
  const withUrls = (candidate) => ({
    width: candidate.width,
    height: candidate.height,
    filename: candidate.filename,
    src: assetUrl(candidate.filename),
  });
  const candidateSet = (candidates) => {
    const normalized = candidates.map(withUrls);
    return {
      candidates: normalized,
      srcset: normalized.map((candidate) => `${candidate.src} ${candidate.width}w`).join(', '),
    };
  };
  const fallbackCandidates = candidateSet(image.fallback.srcset);
  const fallback = {
    format: image.fallback.format,
    src: fallbackCandidates.candidates.at(-1)?.src,
    candidates: fallbackCandidates.candidates,
    srcset: fallbackCandidates.srcset,
  };
  const formats = Object.fromEntries(Object.entries(image.formats).map(([format, source]) => [format, {
    type: `image/${format}`,
    ...candidateSet(source.srcset),
  }]));

  return {
    id: image.id,
    owner: image.owner,
    width: image.width,
    height: image.height,
    intrinsicWidth: image.intrinsicWidth,
    intrinsicHeight: image.intrinsicHeight,
    aspectRatio: image.aspectRatio,
    priority: image.priority,
    fallback,
    formats,
  };
}

function loadResponsiveImageManifest(manifestPath) {
  let manifest;
  try {
    delete require.cache[require.resolve(manifestPath)];
    manifest = require(manifestPath);
  } catch (error) {
    throw new Error(`Could not load responsive image manifest ${manifestPath}: ${error.message}`, { cause: error });
  }
  if (!manifest || !Array.isArray(manifest.entries) || !manifest.pages || typeof manifest.pages !== 'object' || Array.isArray(manifest.pages)) {
    throw new TypeError('Responsive image manifest must export { entries: [], pages: {} }.');
  }
  return manifest;
}

class ResponsiveImagesPlugin {
  constructor({ entries, pages, site, assetUrl, manifestPath, repoRoot }) {
    this.entryPoints = entries;
    this.pages = pages;
    this.site = site;
    this.assetUrl = assetUrl;
    this.manifestPath = manifestPath;
    this.repoRoot = repoRoot;
    this.generated = { assets: [], sourcePaths: [] };
  }

  apply(compiler) {
    const pluginName = 'ResponsiveImagesPlugin';

    compiler.hooks.beforeCompile.tapPromise(pluginName, async () => {
      const manifest = loadResponsiveImageManifest(this.manifestPath);
      validateResponsiveImageEntries(manifest.entries, { repoRoot: this.repoRoot });

      for (const [pageId, imageIds] of Object.entries(manifest.pages)) {
        if (!this.pages.some((page) => page.id === pageId)) {
          throw new Error(`Responsive image manifest refers to inactive or unknown page "${pageId}".`);
        }
        if (!Array.isArray(imageIds) || new Set(imageIds).size !== imageIds.length) {
          throw new Error(`Responsive image manifest page "${pageId}" must list unique image IDs in an array.`);
        }
      }

      const ownerEntries = manifest.entries.filter((image) => image.owner === this.site.demoId);
      const imagesById = new Map(ownerEntries.map((image) => [image.id, image]));
      for (const [pageId, imageIds] of Object.entries(manifest.pages)) {
        const page = this.pages.find((item) => item.id === pageId);
        for (const imageId of imageIds) {
          const image = imagesById.get(imageId);
          if (!image) {
            if (page.demoId === this.site.demoId) {
              throw new Error(`Responsive image "${imageId}" assigned to ${pageId} is not registered for demo "${this.site.demoId}".`);
            }
            continue;
          }
        }
      }

      const result = await generateResponsiveImageVariants(ownerEntries, { repoRoot: this.repoRoot });
      const generatedImages = new Map(Object.entries(result.images));
      for (const page of this.pages) {
        const pageData = this.entryPoints[page.id]?.data;
        if (!pageData) continue;
        pageData.responsiveImages = {};
        if (page.demoId !== this.site.demoId) continue;
        for (const imageId of manifest.pages[page.id] || []) {
          const generatedImage = generatedImages.get(imageId);
          if (!generatedImage) throw new Error(`Responsive image generator omitted registered image "${imageId}".`);
          pageData.responsiveImages[imageId] = createPictureImage(generatedImage, this.assetUrl);
        }
      }

      this.generated = {
        assets: result.assets,
        sourcePaths: ownerEntries.map((image) => path.resolve(this.repoRoot, image.source)),
      };
    });

    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      compilation.fileDependencies.add(this.manifestPath);
      for (const sourcePath of this.generated.sourcePaths) compilation.fileDependencies.add(sourcePath);
      compilation.hooks.processAssets.tap({
        name: pluginName,
        stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
      }, () => {
        for (const asset of this.generated.assets) {
          if (compilation.getAsset(asset.filename)) {
            throw new Error(`Responsive image output collision: ${asset.filename}.`);
          }
          compilation.emitAsset(asset.filename, new RawSource(asset.buffer), {
            sourceFilename: path.relative(this.repoRoot, asset.source).split(path.sep).join('/'),
          });
        }
      });
    });
  }
}

module.exports = { ResponsiveImagesPlugin, createPictureImage, loadResponsiveImageManifest };
