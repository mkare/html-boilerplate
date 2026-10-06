const PAGE_SIZE = 2;

const posts = [
  {
    id: 'post.design-tokens',
    pageId: 'blog.article.tokens-guide',
    slug: 'practical-guide-to-design-tokens',
    title: 'A practical guide to design tokens',
    description: 'A small, durable token system can connect product decisions to every screen without slowing teams down.',
    publishedAt: '2026-09-24T09:00:00.000Z',
    updatedAt: '2026-09-26T12:30:00.000Z',
    author: { name: 'Mara Bell', role: 'Design systems lead' },
    tags: [
      { slug: 'design', label: 'Design systems' },
      { slug: 'workflow', label: 'Workflow' },
    ],
    cover: {
      kind: 'abstract-css',
      tone: 'indigo',
      alt: 'Layered indigo and lilac shapes representing a shared design language',
      caption: 'A shared set of small decisions makes a product feel coherent.',
    },
    draft: false,
    locale: 'en',
    content: [
      {
        heading: 'Start with decisions people repeat',
        paragraphs: [
          'Tokens work best when they capture decisions a team makes again and again. Color, spacing, type scale, and focus treatment are useful starting points because they appear across many screens.',
          'Begin with a short list that has clear names and a real purpose. A token should help someone choose a value with confidence, not add another layer of vocabulary to memorize.',
        ],
        list: ['Name values by use, such as surface or text-muted.', 'Keep the scale small enough to explain.', 'Record the reason behind a token when it is not obvious.'],
      },
      {
        heading: 'Make the system easy to change',
        paragraphs: [
          'A semantic layer lets a brand change without rewriting every component. Components ask for an accent or a border; a theme decides the exact value.',
          'Review tokens in context. A palette that looks balanced in a swatch can still fail when it is used for body text, a disabled control, or a dark surface.',
        ],
        list: [],
      },
      {
        heading: 'Treat documentation as part of the interface',
        paragraphs: [
          'A useful token catalog shows the value, where it belongs, and an example of the decision in a real component. That short explanation often prevents more drift than another layer of tooling.',
        ],
        list: [],
      },
    ],
  },
  {
    id: 'post.accessible-states',
    pageId: 'blog.article.accessible-states',
    slug: 'designing-accessible-product-states',
    title: 'Designing accessible product states',
    description: 'Empty, loading, error, and success states are part of the product journey. Give each one clear meaning and a useful next step.',
    publishedAt: '2026-09-18T10:15:00.000Z',
    updatedAt: '2026-09-20T08:00:00.000Z',
    author: { name: 'Inez Park', role: 'Product designer' },
    tags: [
      { slug: 'design', label: 'Design systems' },
      { slug: 'accessibility', label: 'Accessibility' },
    ],
    cover: {
      kind: 'abstract-css',
      tone: 'mint',
      alt: 'Overlapping mint and teal panels suggesting a clear path through a task',
      caption: 'Every state should tell people what happened and what they can do next.',
    },
    draft: false,
    locale: 'en',
    content: [
      {
        heading: 'Give status a name',
        paragraphs: [
          'A status should be communicated through text as well as color. People need to know whether a save finished, a search found nothing, or a request needs another try.',
          'Keep the message close to the control or content it describes. For changing status, use an appropriate live region and avoid moving focus unless the user needs to act in a new context.',
        ],
        list: ['State what happened in plain language.', 'Keep the message visible until it is no longer useful.', 'Offer one clear action when recovery is possible.'],
      },
      {
        heading: 'Design empty states with purpose',
        paragraphs: [
          'An empty screen can explain why there is no content yet and how to get started. Avoid treating an empty result as an error when it is a normal outcome.',
          'For loading states, preserve the page structure where possible. Stable layouts reduce surprise and help people keep their place while content arrives.',
        ],
        list: [],
      },
      {
        heading: 'Check the keyboard path',
        paragraphs: [
          'Walk through each state using only a keyboard. Confirm that focus remains visible, the next action is reachable, and status changes are understandable without pointer movement.',
        ],
        list: [],
      },
    ],
  },
  {
    id: 'post.calm-workflow',
    pageId: 'blog.article.calm-workflow',
    slug: 'calm-workflow-for-product-teams',
    title: 'A calmer workflow for product teams',
    description: 'Simple agreements around handoff, review, and ownership reduce avoidable rework while leaving room for exploration.',
    publishedAt: '2026-09-10T08:45:00.000Z',
    updatedAt: '2026-09-11T13:00:00.000Z',
    author: { name: 'Mara Bell', role: 'Design systems lead' },
    tags: [
      { slug: 'workflow', label: 'Workflow' },
      { slug: 'teams', label: 'Teams' },
    ],
    cover: {
      kind: 'abstract-css',
      tone: 'amber',
      alt: 'Warm amber and cream blocks arranged in a steady rhythm',
      caption: 'Clear agreements make collaboration feel lighter.',
    },
    draft: false,
    locale: 'en',
    content: [
      {
        heading: 'Make the next step visible',
        paragraphs: [
          'Teams lose time when work changes hands without its current question, owner, or decision. A small handoff note can preserve the context people need without creating a large process document.',
          'Describe the next action and who owns it. If there is uncertainty, name the open question instead of hiding it in a status label.',
        ],
        list: ['What is ready for review?', 'What decision is needed?', 'Who will take the next step?'],
      },
      {
        heading: 'Protect time for focused work',
        paragraphs: [
          'Batching routine reviews and giving people clear response windows can make the day more predictable. The right rhythm depends on the team, so start with one small agreement and adjust it together.',
        ],
        list: [],
      },
      {
        heading: 'Keep the process easy to revise',
        paragraphs: [
          'A workflow is useful only while it helps the people doing the work. Check for repeated delays, remove steps that do not change a decision, and keep the parts that protect quality.',
        ],
        list: [],
      },
    ],
  },
  {
    id: 'post.small-signals',
    pageId: 'blog.article.small-signals',
    slug: 'small-signals-better-interfaces',
    title: 'Small signals make better interfaces',
    description: 'Thoughtful labels, focus styles, and feedback details help people understand what a screen will do before they commit.',
    publishedAt: '2026-09-02T11:20:00.000Z',
    updatedAt: '2026-09-04T09:10:00.000Z',
    author: { name: 'Inez Park', role: 'Product designer' },
    tags: [
      { slug: 'design', label: 'Design systems' },
      { slug: 'research', label: 'Product craft' },
    ],
    cover: {
      kind: 'abstract-css',
      tone: 'coral',
      alt: 'Coral and rose shapes with a small contrasting highlight',
      caption: 'A clear response turns a small interaction into a confident one.',
    },
    draft: false,
    locale: 'en',
    content: [
      {
        heading: 'Feedback closes the loop',
        paragraphs: [
          'A button press is a question: did the action happen? A short, timely response can answer that question and let someone continue without repeating the task.',
          'The response does not need to be elaborate. A changed label, a saved message, or a clear error can be enough when it appears in a predictable place.',
        ],
        list: [],
      },
      {
        heading: 'Labels set expectations',
        paragraphs: [
          'Use labels that describe the result of an action. “Save changes” says more than “Continue” when the person is editing a form, and it remains useful when the surrounding screen changes.',
        ],
        list: ['Prefer specific action words.', 'Keep keyboard focus visible.', 'Explain when an action cannot be reversed.'],
      },
      {
        heading: 'Details accumulate',
        paragraphs: [
          'Small interface signals are easy to overlook in a mockup. Reviewing them in a working prototype helps a team catch uncertainty before it becomes a repeated product problem.',
        ],
        list: [],
      },
    ],
  },
  {
    id: 'post.turkish-localization-draft',
    pageId: null,
    slug: 'turkish-localization-checklist',
    title: 'A practical Turkish localization checklist',
    description: 'Draft notes on Turkish casing, route slugs, and typography in interface content.',
    publishedAt: '2026-09-28T09:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    author: { name: 'Inez Park', role: 'Product designer' },
    tags: [{ slug: 'localization', label: 'Localization' }],
    cover: {
      kind: 'abstract-css',
      tone: 'plum',
      alt: 'Plum and lilac shapes with a high contrast edge',
      caption: 'Draft cover artwork.',
    },
    draft: true,
    locale: 'tr',
    content: [],
  },
  {
    id: 'post.future-editorial-systems',
    pageId: null,
    slug: 'editorial-systems-for-small-teams',
    title: 'Editorial systems for small teams',
    description: 'A forthcoming article about keeping a publication consistent as it grows.',
    publishedAt: '2026-12-01T09:00:00.000Z',
    updatedAt: '2026-12-01T09:00:00.000Z',
    author: { name: 'Mara Bell', role: 'Design systems lead' },
    tags: [{ slug: 'design', label: 'Design systems' }],
    cover: {
      kind: 'abstract-css',
      tone: 'indigo',
      alt: 'Indigo editorial shapes against a soft lilac background',
      caption: 'Forthcoming article cover artwork.',
    },
    draft: false,
    locale: 'en',
    content: [],
  },
];

function getPublishedPosts(items, buildNow) {
  const cutoff = Date.parse(buildNow);
  if (!Number.isFinite(cutoff)) throw new TypeError('getPublishedPosts() needs a valid buildNow date.');

  return items
    .filter((post) => !post.draft && Date.parse(post.publishedAt) <= cutoff)
    .slice()
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.id.localeCompare(b.id));
}

function getPostsByTag(items, tagSlug, buildNow) {
  return getPublishedPosts(items, buildNow).filter((post) => post.tags.some((tag) => tag.slug === tagSlug));
}

function formatDate(value, locale = 'en') {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(value));
}

module.exports = { PAGE_SIZE, posts, getPublishedPosts, getPostsByTag, formatDate };
