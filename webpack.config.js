const fs = require('node:fs');
const path = require('node:path');
const PugPlugin = require('pug-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const { getSiteConfig } = require('./config/site.config.cjs');
const { getBuildConfig } = require('./config/build.config.cjs');
const { loadPages, generatePageWrappers, REPO_ROOT } = require('./build/pages/manifest.cjs');
const { mergePageData } = require('./build/pages/data.cjs');
const { createRouteHelper, createAssetUrlHelper } = require('./build/helpers/urls.cjs');
const { assertProps } = require('./build/helpers/assert-props.cjs');
const { requireFresh } = require('./build/helpers/require-fresh.cjs');
const { PublicAssetsPlugin, SiteMetadataPlugin, PageManifestWatchPlugin, PublishBuildPlugin } = require('./build/webpack/plugins.cjs');
const { ResponsiveImagesPlugin } = require('./build/webpack/responsive-images-plugin.cjs');

function safeAssetName(value) {
  return String(value || 'asset')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'asset';
}

function outputForAsset(kind, pages) {
  return (pathData) => {
    const source = pathData.filename && path.resolve(pathData.filename);
    const overrideRoot = path.resolve(REPO_ROOT, '.generated/project-overrides');
    if (source && source.startsWith(`${overrideRoot}${path.sep}`)) {
      const owner = path.basename(source, path.extname(source)) === 'tokens' ? 'project-tokens' : 'project-custom';
      return `assets/${kind}/project/${owner}.[contenthash:8].${kind === 'css' ? 'css' : 'js'}`;
    }
    const page = pages.find((item) => {
      const candidates = kind === 'css' ? item.styles || [] : item.script ? [item.script] : [];
      return candidates.some((candidate) => path.resolve(REPO_ROOT, candidate) === source);
    });
    const sourceName = pathData.filename || pathData.chunk?.name || 'asset';
    const fallback = path.basename(sourceName, path.extname(sourceName));
    const owner = page ? safeAssetName(page.id) : safeAssetName(fallback);
    const extension = kind === 'css' ? 'css' : 'js';
    return `assets/${kind}/pages/${owner}.[contenthash:8].${extension}`;
  };
}

function createNavigation(pages, route, overrideNavigation = null) {
  const groups = {
    mainNavigation: [],
    footerNavigation: [],
    blueprintNavigation: [],
  };
  const names = { main: 'mainNavigation', footer: 'footerNavigation', blueprint: 'blueprintNavigation' };
  const overrides = new Map((overrideNavigation?.items || []).map((item) => [item.pageId, item]));
  const foundOverrides = new Set();

  for (const page of pages) {
    const override = overrides.get(page.id);
    if (override) foundOverrides.add(page.id);
    if (override?.hidden) continue;
    const navigation = page.navigation || {};
    if (!navigation.label && !override?.label) continue;
    const pageGroups = override?.groups || navigation.groups || (navigation.group ? [navigation.group] : []);
    for (const group of pageGroups) {
      const target = names[group];
      if (!target) throw new Error(`Page ${page.id} uses unknown navigation group "${group}".`);
      groups[target].push({
        id: page.id,
        pageId: page.id,
        label: override?.label || navigation.label,
        order: Number.isFinite(override?.order) ? override.order : (Number.isFinite(navigation.order) ? navigation.order : 0),
        href: route(page.id),
      });
    }
  }
  for (const item of overrideNavigation?.items || []) {
    if (!foundOverrides.has(item.pageId)) process.stderr.write(`Project override navigation.json ignored item for inactive or unknown page "${item.pageId}".\n`);
  }
  for (const items of Object.values(groups)) items.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return groups;
}

function loadPageData(page) {
  if (!page.data) return {};
  const dataPath = path.resolve(REPO_ROOT, page.data);
  try {
    const data = requireFresh(dataPath);
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new TypeError('module must export an object of Pug locals');
    }
    return data;
  } catch (error) {
    throw new Error(`Page ${page.id} (${page.source}) could not load data module ${page.data}: ${error.message}`, { cause: error });
  }
}

function createPageAssertProps(page) {
  return (componentName, props, schema) => assertProps(componentName, props, schema, {
    pageId: page.id,
    source: page.source,
  });
}

function walkFiles(directory, predicate, found = []) {
  if (!fs.existsSync(directory)) return found;
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, item.name);
    if (item.isDirectory()) walkFiles(absolute, predicate, found);
    else if (item.isFile() && predicate(absolute)) found.push(absolute);
  }
  return found;
}

function resolveWebpackInputs(env = {}, argv = {}) {
  const build = getBuildConfig(env, argv);
  const site = getSiteConfig({ ...process.env, ...env });
  const { pages, outputs, manifestPayload } = loadPages({ buildNow: build.buildNow, site, profile: build.name });
  return { build, site, pages, outputs, manifestPayload };
}

function validateWebpackInputs(env = {}, argv = {}) {
  const { build, site, pages } = resolveWebpackInputs(env, argv);
  return { profile: build.name, demoId: site.demoId, pageCount: pages.length };
}

function createWebpackConfig(env = {}, argv = {}) {
  const { build, site, pages, outputs, manifestPayload } = resolveWebpackInputs(env, argv);
  const wrappers = generatePageWrappers(pages);
  const route = createRouteHelper(pages, site);
  const assetUrl = createAssetUrlHelper(site);
  const navigation = createNavigation(pages, route, site.projectOverrides?.navigation);
  const brandByDemo = { agency: 'Fieldwork', saas: 'Orbit' };
  const entry = Object.fromEntries(pages.map((page) => {
    const moduleData = loadPageData(page);
    const generatedPageData = page._pugData && typeof page._pugData === 'object' ? page._pugData : {};
    const usesProjectOverrides = page.demoId === site.demoId || page.id === 'system.404';
    const brandOverride = usesProjectOverrides ? site.projectOverrides?.brand : null;
    const pageData = mergePageData({
      site: site.pageData || {},
      theme: site.themeData?.[page.theme] || {},
      demo: { demoBrand: brandByDemo[page.demoId] || 'Interface Kit' },
      page: moduleData,
      content: generatedPageData,
      custom: {
        demoBrand: brandOverride?.name,
        brandLogoSrc: brandOverride?.logo ? assetUrl(brandOverride.logo) : '',
        projectThemeStyles: Boolean(usesProjectOverrides && site.projectOverrides?.tokensScssPath),
        projectCustomStyles: Boolean(usesProjectOverrides && site.projectOverrides?.customScssPath),
      },
    });
    return [page.id, {
      import: wrappers.get(page.id) || path.resolve(REPO_ROOT, page.source),
      filename: page.output,
      data: {
        ...pageData,
        pageData,
        title: page.title,
        pageId: page.id,
        routePath: page.route,
        locale: page.locale,
        direction: page.direction,
        theme: page.theme,
        layout: page.layout,
        description: page.description || '',
        robots: build.preview ? 'noindex,follow' : (page.robots || ''),
        siteUrl: site.siteUrl,
        basePath: site.basePath,
        assetBase: site.assetBase,
        buildNow: build.buildNow,
        responsiveImages: {},
        route,
        assetUrl,
        ...navigation,
        externalNavigation: site.externalNavigation,
        assertProps: createPageAssertProps(page),
      },
    }];
  }));

  const aliases = {
    '@components': path.resolve(REPO_ROOT, 'src/components'),
    '@layouts': path.resolve(REPO_ROOT, 'src/layouts'),
    '@images': path.resolve(REPO_ROOT, 'src/assets/images'),
    '@fonts': path.resolve(REPO_ROOT, 'src/assets/fonts'),
    '@scss': path.resolve(REPO_ROOT, 'src/scss'),
    '@js': path.resolve(REPO_ROOT, 'src/js'),
    '@core': path.resolve(REPO_ROOT, 'src/core'),
    '@styles': path.resolve(REPO_ROOT, 'src/styles'),
    '@ui': path.resolve(REPO_ROOT, 'src/ui'),
    '@features': path.resolve(REPO_ROOT, 'src/features'),
    '@blocks': path.resolve(REPO_ROOT, 'src/blocks'),
    '@pages': path.resolve(REPO_ROOT, 'src/pages'),
    '@views': path.resolve(REPO_ROOT, 'src/views'),
    '@themes': path.resolve(REPO_ROOT, 'src/themes'),
    '@content': path.resolve(REPO_ROOT, 'src/content'),
    '@projectSourceOverrides': path.resolve(REPO_ROOT, 'project/overrides'),
    '@projectOverrides': path.resolve(REPO_ROOT, '.generated/project-overrides'),
  };

  const publicRoot = path.resolve(REPO_ROOT, 'public');
  const pageOutputs = new Map([...outputs].filter(([, owner]) => !owner.startsWith('public/')));
  const sourceRoots = [
    'src/pages', 'src/views', 'src/content', 'project/overrides', 'project/overrides/pages',
  ].map((relative) => path.resolve(REPO_ROOT, relative));
  const pageJsonFiles = sourceRoots.flatMap((root) => walkFiles(root, (file) => path.basename(file) === 'page.json'));
  const pageDataFiles = pages.map((page) => page.data ? path.resolve(REPO_ROOT, page.data) : null).filter(Boolean);
  const markdownFiles = walkFiles(path.resolve(REPO_ROOT, 'src'), (file) => /\.md$/i.test(file));

  return {
    mode: build.mode,
    context: REPO_ROOT,
    entry: {},
    output: {
      path: path.resolve(REPO_ROOT, '.generated/webpack-output'),
      publicPath: site.assetBase,
      filename: 'assets/js/[name].[contenthash:8].js',
      chunkFilename: 'assets/js/chunks/[name].[contenthash:8].js',
      assetModuleFilename: 'assets/media/[name].[contenthash:8][ext]',
      pathinfo: false,
    },
    devtool: build.devtool,
    optimization: {
      minimize: build.minimize,
      // Retain Webpack's Terser defaults: console calls remain, ordinary
      // comments are removed, and license comments are extracted to .LICENSE.txt.
      runtimeChunk: 'single',
    },
    plugins: [
      new ResponsiveImagesPlugin({
        entries: entry,
        pages,
        site,
        assetUrl,
        manifestPath: path.resolve(REPO_ROOT, 'config/responsive-images.cjs'),
        repoRoot: REPO_ROOT,
      }),
      new CleanWebpackPlugin(),
      new PugPlugin({
        entry,
        js: { filename: outputForAsset('js', pages), chunkFilename: 'assets/js/chunks/[name].[contenthash:8].js' },
        css: { filename: outputForAsset('css', pages), chunkFilename: 'assets/css/chunks/[name].[contenthash:8].css' },
        minify: build.htmlMinify,
        minifyOptions: {
          collapseWhitespace: true,
          conservativeCollapse: true,
          keepClosingSlash: true,
          removeComments: true,
          removeRedundantAttributes: false,
          removeScriptTypeAttributes: true,
          removeStyleLinkTypeAttributes: true,
          useShortDoctype: true,
          minifyCSS: true,
          minifyJS: false,
        },
        pretty: build.htmlPretty,
        preprocessorOptions: {
          embedFilters: {
            markdown: {
              highlight: {
                verbose: true,
                use: 'prismjs',
              },
            },
          },
        },
        watchFiles: {
          includes: [/\.md$/, /(^|[\\/])page\.json$/, /\.page\.data\.cjs$/],
        },
        hotUpdate: true,
      }),
      new PublicAssetsPlugin({ publicRoot, pageOutputs }),
      new SiteMetadataPlugin({ manifestPayload }),
      new PageManifestWatchPlugin({
        sourceRoots,
        manifestFiles: [...pageJsonFiles, ...pageDataFiles, ...markdownFiles, ...(site.projectOverrides?.watchFiles || [])],
      }),
      new PublishBuildPlugin({
        outputPath: path.resolve(REPO_ROOT, '.generated/webpack-output'),
        distPath: path.resolve(REPO_ROOT, 'dist'),
        manifestPayload,
      }),
    ],
    module: {
      rules: [
        {
          test: /\.s[ac]ss$/i,
          use: [
            'css-loader',
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  plugins: [require('autoprefixer')()],
                },
              },
            },
            {
              loader: 'sass-loader',
              options: { sassOptions: { quietDeps: true } },
            },
          ],
        },
        {
          test: /\.(png|svg|jpe?g|gif|webp|avif)$/i,
          type: 'asset/resource',
          generator: { filename: 'assets/images/[name].[contenthash:8][ext]' },
        },
        {
          test: /\.(woff2?|ttf|otf|eot)$/i,
          type: 'asset/resource',
          generator: { filename: 'assets/fonts/[name].[contenthash:8][ext]' },
        },
      ],
    },
    resolve: { alias: aliases },
    watchOptions: { ignored: ['**/node_modules/**', '**/.generated/**', '**/dist/**'] },
    devServer: {
      static: { directory: path.resolve(REPO_ROOT, 'dist'), serveIndex: false },
      watchFiles: {
        paths: ['src/**/*.*', 'config/**/*.*', 'build/**/*.*', 'public/**/*.*', 'project/**/*.*'],
        options: { usePolling: false, ignored: ['**/.generated/**'] },
      },
      open: process.env.OPEN_BROWSER === '1',
      compress: true,
      liveReload: true,
      hot: true,
      port: Number(process.env.PORT || 9000),
      historyApiFallback: false,
      client: { overlay: true },
    },
  };
}

module.exports = (env, argv) => createWebpackConfig(env, argv);
module.exports.createWebpackConfig = createWebpackConfig;
module.exports.validateWebpackInputs = validateWebpackInputs;
module.exports.loadPageData = loadPageData;
module.exports.createPageAssertProps = createPageAssertProps;
module.exports.createNavigation = createNavigation;
