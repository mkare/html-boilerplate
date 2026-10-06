const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pug = require('pug');
const { assertProps } = require('../../build/helpers/assert-props.cjs');

const root = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const agencyPages = [
  'src/pages/agency/home/page.pug',
  'src/pages/agency/about/page.pug',
  'src/pages/agency/services/page.pug',
  'src/pages/agency/services/brand-strategy/page.pug',
  'src/pages/agency/projects/page.pug',
  'src/pages/agency/projects/northline/page.pug',
];

for (const page of agencyPages) {
  const source = read(page);
  assert.match(source, /include @blocks\/agency\/cta\/cta\.pug/, `${page} includes the Agency CTA block`);
  assert.match(source, /\+agencyCta\(/, `${page} uses the Agency CTA block`);
  assert.doesNotMatch(source, /\.agency-shell\.agency-cta/, `${page} does not duplicate the CTA structure`);
}

const testimonialBlock = read('src/blocks/marketing/testimonial-card/testimonial-card.pug');
assert.match(testimonialBlock, /assertProps\('block-marketing-testimonial-card'/, 'testimonial block validates its public props');
assert.match(testimonialBlock, /blockquote= props\.quote/, 'testimonial quote uses escaped Pug output');
for (const page of ['src/views/marketing/marketing.pug', 'src/pages/saas/home/page.pug']) {
  const source = read(page);
  assert.match(source, /include @blocks\/marketing\/testimonial-card\/testimonial-card\.pug/, `${page} includes the testimonial block`);
  assert.match(source, /\+marketingTestimonialCard\(/, `${page} uses the testimonial block`);
  assert.doesNotMatch(source, /figure\.testimonial-card/, `${page} does not duplicate the testimonial structure`);
}

function renderBlock(relativeBlock, invocation, { nested = false } = {}) {
  const filename = path.join(root, 'qa/phase-5/block-composition-fixture.pug');
  const blockPath = path.relative(path.dirname(filename), path.join(root, relativeBlock)).split(path.sep).join('/');
  const source = nested ? `.agency\n  include ${blockPath}\n  ${invocation}` : `include ${blockPath}\n\n${invocation}`;
  return pug.render(source, {
    filename,
    assertProps,
  });
}

const agencyHtml = renderBlock(
  'src/blocks/agency/cta/cta.pug',
  '+agencyCta({ eyebrow: "<em>Prompt</em>", title: "Studio & Co", action: "Go <now>", href: "/contact/" })',
  { nested: true },
);
assert.match(agencyHtml, /&lt;em&gt;Prompt&lt;\/em&gt;/, 'Agency CTA text is escaped');
assert.match(agencyHtml, /Go &lt;now&gt;/, 'Agency CTA action text is escaped');
assert.match(agencyHtml, /Go &lt;now&gt; <span class="agency-arrow"/, 'Agency CTA retains the text-to-arrow spacing');
assert.match(agencyHtml, /href="\/contact\/"/, 'Agency CTA preserves its route link');

const testimonialHtml = renderBlock(
  'src/blocks/marketing/testimonial-card/testimonial-card.pug',
  '+marketingTestimonialCard({ initials: "RA", ratingLabel: "Five out of five stars", ratingText: "★ ★ ★ ★ ★", quote: "<script>quote</script>", author: "Rhea & Co", role: "VP Product" })',
);
assert.match(testimonialHtml, /&lt;script&gt;quote&lt;\/script&gt;/, 'testimonial quote is escaped');
assert.match(testimonialHtml, /aria-label="Five out of five stars"/, 'testimonial exposes the rating label');
assert.match(testimonialHtml, /class="testimonial-card__avatar" aria-hidden="true">RA</, 'testimonial monogram keeps the default markup');
const wrappedTestimonialHtml = renderBlock(
  'src/blocks/marketing/testimonial-card/testimonial-card.pug',
  '+marketingTestimonialCard({ initials: "RA", wrapInitials: true, ratingLabel: "Five out of five stars", ratingText: "★ ★ ★ ★ ★", quote: "Quote", author: "Rhea", role: "VP" })',
);
assert.match(wrappedTestimonialHtml, /class="testimonial-card__avatar" aria-hidden="true"><span>RA<\/span>/, 'testimonial supports the legacy wrapped monogram markup');

const marketingPage = read('src/views/marketing/marketing.pug');
const marketingHero = read('src/blocks/marketing/hero/hero.pug');
const marketingStats = read('src/blocks/marketing/stats/stats.pug');
assert.match(marketingPage, /include @blocks\/marketing\/stats\/stats\.pug/, 'marketing page includes the shared stats block');
assert.match(marketingPage, /include @blocks\/marketing\/hero\/hero\.pug/, 'marketing page includes the shared hero block');
assert.match(marketingPage, /\+marketingHero\(/, 'marketing page composes its hero through the shared block');
assert.match(marketingPage, /\+marketingProductPreview\(\)/, 'marketing page keeps the product preview in the hero art slot');
assert.doesNotMatch(marketingPage, /section\.marketing-hero\(aria-labelledby=/, 'marketing page does not duplicate the hero structure');
assert.doesNotMatch(marketingPage, /dl\.marketing-hero__proof|dl\.marketing-stats/, 'marketing page does not duplicate the stats structure');
assert.match(marketingHero, /\+marketingStats\(props\.stats\)/, 'marketing hero composes the shared stats block');
assert.match(marketingHero, /aria-labelledby=props\.id/, 'marketing hero labels its section with the supplied heading ID');
assert.match(marketingStats, /dl\.marketing-stats/, 'marketing stats use a semantic description list');
assert.match(marketingStats, /dt= item\.value[\s\S]*dd= item\.label/, 'marketing stat values and labels use escaped Pug output');

const marketingFixtureFilename = path.join(root, 'qa/phase-5/marketing-hero-fixture.pug');
const marketingFixtureIncludes = [
  'src/blocks/marketing/kicker/kicker.pug',
  'src/blocks/marketing/stats/stats.pug',
  'src/blocks/marketing/hero/hero.pug',
  'src/blocks/marketing/product-preview/product-preview.pug',
].map((relativeInclude) => {
  const includePath = path.relative(path.dirname(marketingFixtureFilename), path.join(root, relativeInclude)).split(path.sep).join('/');
  return 'include ' + includePath;
});
const marketingHeroInvocation = [
  '+marketingHero({ id: "marketing-title", kicker: "The calm workspace for growing teams", title: "Make your next good idea feel inevitable.", description: "Orbit gives product teams one focused space to plan, ship and learn — without turning progress into busywork.", primaryAction: "Start for free", primaryHref: "#newsletter", secondaryAction: "See how it works", secondaryHref: "#features", stats: [{ value: "12k+", label: "teams building calmly" }, { value: "4.9/5", label: "average customer rating" }, { value: "32%", label: "less status-meeting time" }] })',
  '  +marketingProductPreview()',
].join('\n');
const marketingHeroHtml = pug.render([...marketingFixtureIncludes, marketingHeroInvocation].join('\n'), {
  filename: marketingFixtureFilename,
  assertProps,
});
assert.match(marketingHeroHtml, /<section class="marketing-hero" aria-labelledby="marketing-title">/, 'rendered marketing hero associates its section with the heading');
assert.match(marketingHeroHtml, /<h1 id="marketing-title">Make your next good idea feel inevitable\.<\/h1>/, 'rendered marketing hero preserves its current headline');
assert.match(marketingHeroHtml, /href="#newsletter"/, 'rendered marketing hero preserves its primary destination');
assert.match(marketingHeroHtml, /class="marketing-button marketing-button--primary"[^>]*>Start for free<span aria-hidden="true">→<\/span>/, 'rendered marketing hero preserves its primary action and decorative arrow');
assert.match(marketingHeroHtml, /<dl class="marketing-stats">[\s\S]*?<dt>12k\+<\/dt>[\s\S]*?<dd>teams building calmly<\/dd>/, 'rendered marketing hero includes semantic proof stats');
assert.match(marketingHeroHtml, /class="marketing-hero__art" aria-hidden="true">[\s\S]*class="product-window"/, 'rendered product preview remains in the decorative art slot');

const dashboard = read('src/views/dashboard/dashboard.pug');
for (const [mixin, minimumUses] of [
  ['dashboardKpiCard', 4],
  ['dashboardActivityItem', 8],
  ['dashboardProjectRow', 1],
  ['dashboardReportCard', 3],
  ['dashboardQuickAction', 3],
]) {
  const uses = dashboard.match(new RegExp(`\\+${mixin}\\(`, 'g')) || [];
  assert(uses.length >= minimumUses, `dashboard delegates ${mixin} data presentations to blocks (${uses.length} found)`);
}

process.stdout.write('Phase 5 block composition passed: Agency CTAs, marketing hero/stats, shared marketing/SaaS testimonials, and Dashboard data blocks are present.\n');
