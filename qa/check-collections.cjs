const assert = require('node:assert/strict');
const { createBlogPages, slugifyTurkish } = require('../build/collections/blog.cjs');

const buildNow = '2026-10-03T12:00:00.000Z';
const collection = {
  type: 'blog',
  pageSize: 2,
  baseRoute: '/blog/',
  archiveTemplateId: 'blog.archive',
  archiveNextTemplateId: 'blog.archive.page2',
  categoryTemplateId: 'blog.category.design',
  articleTemplateId: 'blog.article.template',
  categoryIdPrefix: 'blog.category.',
};
const templates = new Map([
  ['blog.archive', { id: 'blog.archive', route: '/blog/', source: 'archive.pug', title: 'Journal — Interface Kit', description: 'Journal notes.', blueprintId: 'blog.archive', locale: 'en' }],
  ['blog.archive.page2', { id: 'blog.archive.page2', route: '/blog/page/2/', source: 'archive-next.pug', title: 'Journal — Page 2 — Interface Kit', description: 'Journal notes.', blueprintId: 'blog.archive', locale: 'en' }],
  ['blog.category.design', { id: 'blog.category.design', route: '/blog/category/design/', source: 'category.pug', title: 'Design — Journal', description: 'Category.', blueprintId: 'blog.category', locale: 'en' }],
  ['blog.article.template', { id: 'blog.article.template', route: '/blog/template/', source: 'article.pug', title: 'Article — Journal', description: 'Article.', blueprintId: 'blog.article', locale: 'en' }],
]);

function post(index, options = {}) {
  const draft = options.draft || false;
  const publishedAt = options.publishedAt || '2026-09-01T09:00:00.000Z';
  const slug = options.slug || 'story-' + index;
  return {
    id: 'post.' + index,
    pageId: null,
    slug,
    title: 'Story ' + index,
    description: 'Description for story ' + index + '.',
    publishedAt,
    updatedAt: publishedAt,
    author: { name: 'Test Author', role: 'Editor' },
    tags: [{ slug: 'design', label: 'Design systems' }],
    cover: { tone: 'indigo', alt: 'Abstract cover', caption: 'Test cover' },
    draft,
    locale: 'en',
    content: [],
  };
}

function generated(posts) {
  return createBlogPages({
    collection,
    templates,
    contentModule: { PAGE_SIZE: 2, posts },
    buildNow,
  });
}

function count(pages, prefix) {
  return pages.filter((page) => page.id.startsWith(prefix)).length;
}

function archives(pages) {
  return pages
    .filter((page) => page.blueprintId === 'blog.archive')
    .sort((a, b) => a._pugData.pageNumber - b._pugData.pageNumber);
}

for (const [label, items, expectedArchive, expectedArticles] of [
  ['zero', [], 1, 0],
  ['one', [post(1)], 1, 1],
  ['N', [post(1), post(2), post(3), post(4)], 2, 4],
  ['N+1', [post(1), post(2), post(3), post(4), post(5)], 3, 5],
]) {
  const pages = generated(items);
  assert.equal(count(pages, 'blog.archive'), expectedArchive, label + ': archive page count');
  assert.equal(count(pages, 'blog.article.'), expectedArticles, label + ': article page count');
  assert.equal(count(pages, 'blog.category.'), items.length ? 1 : 0, label + ': category count');
  const archivePages = archives(pages);
  assert.deepEqual(archivePages.map((page) => page.route), [
    '/blog/',
    ...Array.from({ length: expectedArchive - 1 }, (_, index) => `/blog/page/${index + 2}/`),
  ], label + ': first, middle, and last routes are canonical and page one has no /page/1/ alias');
  archivePages.forEach((page, index) => {
    assert.equal(page._pugData.pageNumber, index + 1, label + ': archive page number is sequential');
    assert.equal(page._pugData.totalPages, expectedArchive, label + ': archive pages agree on total count');
    assert.equal(page._pugData.archivePageRoutes[String(index + 1)], page.id, label + ': each numbered page resolves to its manifest id');
  });
}

const orderedPosts = [
  post(3, { publishedAt: '2026-09-03T09:00:00.000Z' }),
  post(1, { publishedAt: '2026-09-01T09:00:00.000Z' }),
  post(2, { publishedAt: '2026-09-03T09:00:00.000Z' }),
  post(4, { publishedAt: '2026-09-02T09:00:00.000Z' }),
];
const orderedIds = (items) => archives(generated(items)).flatMap((page) => page._pugData.pagePosts.map((item) => item.id));
const expectedOrder = ['post.2', 'post.3', 'post.4', 'post.1'];
assert.deepEqual(orderedIds(orderedPosts), expectedOrder, 'published dates sort descending and ties sort by stable id');
assert.deepEqual(orderedIds([...orderedPosts].reverse()), expectedOrder, 'permuting source records does not change generated pagination order');

const filtered = generated([
  post(1, { draft: true }),
  post(2, { publishedAt: '2026-12-01T09:00:00.000Z' }),
  post(3),
]);
assert.equal(count(filtered, 'blog.article.'), 1, 'draft and future articles are excluded from generated pages');
assert.equal(filtered.find((page) => page.id === 'blog.archive')._pugData.visiblePosts.length, 1, 'draft and future articles are excluded from archives');
assert.equal(slugifyTurkish('İstanbul IŞIK Çağrı ŞÜPHE'), 'istanbul-isik-cagri-suphe', 'Turkish casing and diacritics normalize consistently');
assert.throws(() => generated([post(1, { slug: 'cagri' }), post(2, { slug: 'Çağrı' })]), /same slug/, 'normalized slug collisions are rejected');
assert.throws(() => generated([post(1, { publishedAt: '2026-02-31T09:00:00.000Z' })]), /valid date/, 'invalid calendar dates are rejected');

process.stdout.write('collection acceptance passed: 0/1/N/N+1 pagination, publication filtering, Turkish slugs, collision and date checks.\n');
