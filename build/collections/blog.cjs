const { safeRepoPath } = require('../helpers/urls.cjs');
const { requireFresh } = require('../helpers/require-fresh.cjs');
const REPO_ROOT = require('node:path').resolve(__dirname, '../..');

function slugifyTurkish(value) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('Blog slug must be a non-empty string.');
  const slug = value
    .normalize('NFC')
    .replace(/[İIı]/g, 'i')
    .replace(/[Şş]/g, 's')
    .replace(/[Ğğ]/g, 'g')
    .replace(/[Üü]/g, 'u')
    .replace(/[Öö]/g, 'o')
    .replace(/[Çç]/g, 'c')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) throw new TypeError(`Blog slug "${value}" has no routable characters.`);
  return slug;
}

function parseContentDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    throw new TypeError(`${label} must be an ISO-8601 UTC timestamp.`);
  }
  const time = Date.parse(value);
  const iso = Number.isFinite(time) ? new Date(time).toISOString() : '';
  const inputMillis = (value.match(/\.(\d{1,3})Z$/)?.[1] || '').padEnd(3, '0');
  if (!Number.isFinite(time) || iso.slice(0, 19) !== value.slice(0, 19) || iso.slice(20, 23) !== (inputMillis || '000')) {
    throw new TypeError(`${label} is not a valid date.`);
  }
  return time;
}

function normalizePosts(posts) {
  if (!Array.isArray(posts)) throw new TypeError('Blog content must export a posts array.');
  const ids = new Set();
  const slugs = new Map();
  return posts.map((post, index) => {
    if (!post || typeof post !== 'object' || Array.isArray(post)) throw new TypeError(`Blog record ${index + 1} must be an object.`);
    if (typeof post.id !== 'string' || !post.id.trim()) throw new TypeError(`Blog record ${index + 1} needs an id.`);
    if (ids.has(post.id)) throw new Error(`Duplicate blog content id "${post.id}".`);
    ids.add(post.id);
    if (typeof post.title !== 'string' || !post.title.trim()) throw new TypeError(`Blog record ${post.id} needs a title.`);
    const publishedAt = parseContentDate(post.publishedAt, `Blog record ${post.id} publishedAt`);
    const updatedAt = parseContentDate(post.updatedAt, `Blog record ${post.id} updatedAt`);
    if (updatedAt < publishedAt) throw new TypeError(`Blog record ${post.id} updatedAt cannot predate publishedAt.`);
    if (typeof post.description !== 'string' || !post.description.trim()) throw new TypeError(`Blog record ${post.id} needs a description.`);
    if (!Array.isArray(post.tags)) throw new TypeError(`Blog record ${post.id} tags must be an array.`);
    const slug = slugifyTurkish(post.slug || post.title);
    const previousId = slugs.get(slug);
    if (previousId) throw new Error(`Blog records ${previousId} and ${post.id} normalize to the same slug "${slug}".`);
    slugs.set(slug, post.id);
    const tags = post.tags.map((tag) => {
      if (!tag || typeof tag !== 'object' || Array.isArray(tag)) throw new TypeError(`Blog record ${post.id} has an invalid tag.`);
      if (typeof tag.label !== 'string' || !tag.label.trim()) throw new TypeError(`Blog record ${post.id} has a tag without a label.`);
      return { ...tag, slug: slugifyTurkish(tag.slug || tag.label) };
    });
    return {
      ...post,
      slug,
      publishedAt: new Date(publishedAt).toISOString(),
      updatedAt: new Date(updatedAt).toISOString(),
      tags,
    };
  });
}

function paginate(items, pageSize) {
  if (!Array.isArray(items)) throw new TypeError('paginate() expects an array.');
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) throw new TypeError('pageSize must be a positive integer.');
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  return Array.from({ length: totalPages }, (_, index) => ({
    currentPage: index + 1,
    totalPages,
    items: items.slice(index * pageSize, (index + 1) * pageSize),
  }));
}

function cloneTemplate(template, overrides) {
  if (!template) throw new Error('Blog collection template is missing.');
  const { collection: _collection, output: _output, _manifestFile: _manifestFile, _legacy: _legacy, ...base } = template;
  return { ...base, ...overrides };
}

function createBlogPages({ collection, templates, contentModule, buildNow }) {
  if (!collection || collection.type !== 'blog') throw new TypeError('A blog collection descriptor is required.');
  const cutoff = Date.parse(buildNow);
  if (!Number.isFinite(cutoff)) throw new TypeError('Blog collection needs a valid buildNow.');
  const pageSize = collection.pageSize ?? contentModule.PAGE_SIZE;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) throw new TypeError('Blog collection pageSize must be a positive integer.');

  const allPosts = normalizePosts(contentModule.posts);
  const publishedPosts = allPosts
    .filter((post) => !post.draft && Date.parse(post.publishedAt) <= cutoff)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.id.localeCompare(b.id))
    .map((post) => ({ ...post, pageId: post.pageId || `blog.article.${post.slug}` }));
  const archivePages = paginate(publishedPosts, pageSize);
  const archiveIds = archivePages.map(({ currentPage }) => currentPage === 1 ? collection.archiveTemplateId : `blog.archive.page${currentPage}`);
  const routeByPageId = new Map(archiveIds.map((id, index) => [index + 1, id]));
  const generated = [];

  for (const page of archivePages) {
    const templateId = page.currentPage === 1 ? collection.archiveTemplateId : collection.archiveNextTemplateId;
    const template = templates.get(templateId);
    if (!template) throw new Error(`Blog archive template "${templateId}" does not exist.`);
    if (page.currentPage > 1 && !templates.has(collection.archiveNextTemplateId)) {
      throw new Error(`Blog archive template "${collection.archiveNextTemplateId}" does not exist.`);
    }
    const id = routeByPageId.get(page.currentPage);
    const route = page.currentPage === 1 ? collection.baseRoute : `${collection.baseRoute}page/${page.currentPage}/`;
    const suffix = page.currentPage === 1 ? '' : ` — Page ${page.currentPage}`;
    generated.push(cloneTemplate(template, {
      id,
      route,
      title: page.currentPage === 1 ? templates.get(collection.archiveTemplateId).title : `${templates.get(collection.archiveTemplateId).title.replace(/\s+—.*$/, '')}${suffix} — Interface Kit`,
      description: page.currentPage === 1 ? templates.get(collection.archiveTemplateId).description : `More published notes from the journal, page ${page.currentPage}.`,
      pageData: {
        visiblePosts: publishedPosts,
        pagePosts: page.items,
        pageNumber: page.currentPage,
        totalPages: page.totalPages,
        archivePageRoutes: Object.fromEntries(routeByPageId),
      },
    }));
  }

  const categoryTemplate = templates.get(collection.categoryTemplateId);
  if (!categoryTemplate) throw new Error(`Blog category template "${collection.categoryTemplateId}" does not exist.`);
  const categories = new Map();
  for (const post of publishedPosts) {
    for (const tag of post.tags) {
      const current = categories.get(tag.slug);
      if (!current) categories.set(tag.slug, { slug: tag.slug, label: tag.label });
    }
  }
  const categoryPageIds = Object.fromEntries([...categories.keys()].map((slug) => [slug, `${collection.categoryIdPrefix || 'blog.category.'}${slug}`]));
  const archivePageRoutes = Object.fromEntries(routeByPageId);
  for (const page of generated.filter((item) => item.blueprintId === 'blog.archive')) {
    page.pageData.categoryPageIds = categoryPageIds;
  }
  for (const category of [...categories.values()].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const categoryPosts = publishedPosts.filter((post) => post.tags.some((tag) => tag.slug === category.slug));
    const id = `${collection.categoryIdPrefix || 'blog.category.'}${category.slug}`;
    generated.push(cloneTemplate(categoryTemplate, {
      id,
      translationKey: id,
      route: `${collection.baseRoute}category/${category.slug}/`,
      title: `${category.label} — Journal — Interface Kit`,
      description: `Published journal articles about ${category.label.toLocaleLowerCase('en-US')}.`,
      pageData: { category, categoryPosts, visiblePosts: publishedPosts, categoryPageIds, archivePageRoutes },
    }));
  }

  const articleTemplate = templates.get(collection.articleTemplateId);
  if (!articleTemplate) throw new Error(`Blog article template "${collection.articleTemplateId}" does not exist.`);
  for (const post of publishedPosts) {
    const id = post.pageId || `blog.article.${post.slug}`;
    const article = { ...post, pageId: id };
    generated.push(cloneTemplate(articleTemplate, {
      id,
      translationKey: post.translationKey || `blog.article.${post.slug}`,
      route: `${collection.baseRoute}${post.slug}/`,
      title: `${post.title} — Journal — Interface Kit`,
      description: post.description,
      locale: post.locale || articleTemplate.locale,
      pageData: { article, categoryPageIds, archivePageRoutes },
    }));
  }

  for (const page of generated) page._pugData = page.pageData;
  return generated.map(({ pageData: _pageData, ...page }) => page);
}

function loadCollectionData(repoRoot, relativePath) {
  const dataPath = safeRepoPath(repoRoot, relativePath, 'Blog collection data');
  const data = requireFresh(dataPath);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError(`Blog content module ${relativePath} must export an object.`);
  return data;
}

function generateBlogCollection({ collection, templates, buildNow }) {
  const contentModule = loadCollectionData(REPO_ROOT, collection.data);
  return createBlogPages({ collection, templates, contentModule, buildNow });
}

module.exports = { slugifyTurkish, parseContentDate, normalizePosts, paginate, createBlogPages, generateBlogCollection };
