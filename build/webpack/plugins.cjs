const fs = require('node:fs');
const path = require('node:path');
const { RawSource } = require('webpack').sources;
const { collectPublicOutputs, registerOutput, REPO_ROOT, GENERATED_MANIFEST } = require('../pages/manifest.cjs');

class PublicAssetsPlugin {
  constructor({ publicRoot, pageOutputs }) {
    this.publicRoot = publicRoot;
    this.pageOutputs = pageOutputs;
  }

  apply(compiler) {
    const pluginName = 'PublicAssetsPlugin';
    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      compilation.contextDependencies.add(this.publicRoot);
      compilation.hooks.processAssets.tap({
        name: pluginName,
        stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
      }, () => {
        const outputs = new Map(this.pageOutputs);
        const publicFiles = collectPublicOutputs(this.publicRoot);
        for (const file of publicFiles) registerOutput(outputs, file.output, `public/${file.output}`);
        for (const file of publicFiles) {
          if (compilation.getAsset(file.output)) throw new Error(`Output collision: public/${file.output} conflicts with a Webpack asset.`);
          compilation.emitAsset(file.output, new RawSource(fs.readFileSync(file.source)), {
            sourceFilename: path.relative(REPO_ROOT, file.source).split(path.sep).join('/'),
          });
        }
      });
    });
  }
}

function createSitemap(manifest) {
  const { site, pages = [] } = manifest;
  if (!site?.siteUrl || manifest.profile === 'catalog-preview') return null;
  const basePath = site.basePath || '/';
  const locations = pages
    .filter((page) => page.id !== 'system.404' && !(page.robots || '').split(',').some((directive) => directive.trim().toLowerCase() === 'noindex'))
    .map((page) => {
      const route = page.route === '/' ? basePath : `${basePath.replace(/\/$/, '')}${page.route}`;
      return `  <url><loc>${escapeXml(site.siteUrl + route)}</loc></url>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locations.join('\n')}\n</urlset>\n`;
}

function createRobots(manifest) {
  const lines = ['User-agent: *', 'Allow: /'];
  if (manifest.profile !== 'catalog-preview' && manifest.site?.siteUrl) {
    const basePath = manifest.site.basePath || '/';
    lines.push(`Sitemap: ${manifest.site.siteUrl}${basePath}sitemap.xml`);
  }
  return `${lines.join('\n')}\n`;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]);
}

class SiteMetadataPlugin {
  constructor({ manifestPayload }) {
    this.manifestPayload = manifestPayload;
  }

  apply(compiler) {
    compiler.hooks.thisCompilation.tap('SiteMetadataPlugin', (compilation) => {
      compilation.hooks.processAssets.tap({
        name: 'SiteMetadataPlugin',
        stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
      }, () => {
        const robots = createRobots(this.manifestPayload);
        if (compilation.getAsset('robots.txt')) throw new Error('Output collision: generator:robots conflicts with an emitted robots.txt.');
        compilation.emitAsset('robots.txt', new RawSource(robots));
        const sitemap = createSitemap(this.manifestPayload);
        if (sitemap !== null) {
          if (compilation.getAsset('sitemap.xml')) throw new Error('Output collision: generator:sitemap conflicts with an emitted sitemap.xml.');
          compilation.emitAsset('sitemap.xml', new RawSource(sitemap));
        }
      });
    });
  }
}

class PageManifestWatchPlugin {
  constructor({ sourceRoots, manifestFiles }) {
    this.sourceRoots = sourceRoots;
    this.manifestFiles = manifestFiles;
  }

  apply(compiler) {
    compiler.hooks.afterCompile.tap('PageManifestWatchPlugin', (compilation) => {
      for (const directory of this.sourceRoots) {
        if (fs.existsSync(directory)) compilation.contextDependencies.add(directory);
        else compilation.missingDependencies.add(directory);
      }
      for (const file of this.manifestFiles) {
        if (fs.existsSync(file)) compilation.fileDependencies.add(file);
      }
    });
  }
}

function copyCompilerOutput(outputFs, sourceRoot, destinationRoot) {
  if (!outputFs.existsSync(sourceRoot)) throw new Error(`Webpack did not emit staging output at ${sourceRoot}.`);
  const copyDirectory = (sourceDirectory, destinationDirectory) => {
    fs.mkdirSync(destinationDirectory, { recursive: true });
    for (const name of outputFs.readdirSync(sourceDirectory)) {
      const source = path.join(sourceDirectory, name);
      const destination = path.join(destinationDirectory, name);
      if (outputFs.statSync(source).isDirectory()) copyDirectory(source, destination);
      else fs.writeFileSync(destination, outputFs.readFileSync(source));
    }
  };
  copyDirectory(sourceRoot, destinationRoot);
}

function publishSuccessfulBuild(outputFs, outputPath, distPath, manifestPayload) {
  const generatedRoot = path.dirname(outputPath);
  const nextDist = path.join(generatedRoot, 'publish-next');
  const previousDist = path.join(generatedRoot, 'publish-previous');
  const nextManifest = `${GENERATED_MANIFEST}.next`;
  const previousManifest = `${GENERATED_MANIFEST}.previous`;
  const removeGenerated = (target) => {
    if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
  };

  removeGenerated(nextDist);
  removeGenerated(previousDist);
  removeGenerated(nextManifest);
  removeGenerated(previousManifest);
  copyCompilerOutput(outputFs, outputPath, nextDist);
  fs.mkdirSync(path.dirname(GENERATED_MANIFEST), { recursive: true });
  fs.writeFileSync(nextManifest, `${JSON.stringify(manifestPayload, null, 2)}\n`);

  let movedDist = false;
  let movedManifest = false;
  try {
    if (fs.existsSync(distPath)) {
      fs.renameSync(distPath, previousDist);
      movedDist = true;
    }
    if (fs.existsSync(GENERATED_MANIFEST)) {
      fs.renameSync(GENERATED_MANIFEST, previousManifest);
      movedManifest = true;
    }
    fs.renameSync(nextDist, distPath);
    fs.renameSync(nextManifest, GENERATED_MANIFEST);
  } catch (error) {
    if (fs.existsSync(distPath) && movedDist) removeGenerated(distPath);
    if (movedDist && fs.existsSync(previousDist)) fs.renameSync(previousDist, distPath);
    if (movedManifest && fs.existsSync(previousManifest)) fs.renameSync(previousManifest, GENERATED_MANIFEST);
    throw error;
  }

  removeGenerated(previousDist);
  removeGenerated(previousManifest);
}

class PublishBuildPlugin {
  constructor({ outputPath, distPath, manifestPayload }) {
    this.outputPath = outputPath;
    this.distPath = distPath;
    this.manifestPayload = manifestPayload;
  }

  apply(compiler) {
    compiler.hooks.afterEmit.tap('PublishBuildPlugin', (compilation) => {
      if (compilation.errors.length) return;
      try {
        publishSuccessfulBuild(compiler.outputFileSystem, this.outputPath, this.distPath, this.manifestPayload);
      } catch (error) {
        compilation.errors.push(error);
      }
    });
  }
}

module.exports = { PublicAssetsPlugin, SiteMetadataPlugin, PageManifestWatchPlugin, PublishBuildPlugin, createSitemap, createRobots };
