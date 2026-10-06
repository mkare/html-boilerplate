# Marketing hero

Purpose: render the marketing page's headline, actions, proof stats, and decorative art slot as one reusable section.

## Pug API

`+marketingHero({ id, kicker, title, description, primaryAction, primaryHref, secondaryAction, secondaryHref, stats })`

```pug
+marketingHero({ id: 'product-title', kicker: 'Built for teams', title: 'Make good work visible.', description: 'A short supporting sentence.', primaryAction: 'Get started', primaryHref: '#signup', secondaryAction: 'Explore features', secondaryHref: '/features/', stats: [{ value: '12k+', label: 'teams' }] })
  +marketingProductPreview()
```

- All text, labels, and hrefs are required non-empty strings. Text is escaped by Pug.
- `id` must be a valid HTML ID and identifies the heading referenced by the section's `aria-labelledby`; the page owns uniqueness.
- Hrefs may be relative routes, fragments, query URLs, or use `http`, `https`, `mailto`, or `tel`. Route ownership and destination validity remain with the consuming page; external links should be reviewed there.
- `stats` follows the `marketingStats` item contract and must contain at least one `{ value, label }` item.
- The nested Pug block fills the decorative art slot. It is hidden from assistive technology because the art is decorative; put meaningful content outside this block.
- The block has no JavaScript behavior. Its page-specific visual styles are owned by `src/views/marketing/marketing.scss`.
- The hero composes `marketingKicker` and `marketingStats`; include those block files before `hero.pug` in the consuming Pug page.
