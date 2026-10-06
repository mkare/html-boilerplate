# Marketing logo strip

Purpose: show a labeled row of partner names without requiring image assets.

## Pug API

`+marketingLogoStrip({ id, label, items })`

- `label` and a non-empty `items` array are required.
- `id` is optional and defaults to `trusted-title`; provide a unique value if using this block more than once in one document.
- Each item is escaped text. Logos are intentionally text wordmarks in this demo.
- It emits `.logo-strip*` classes. The consuming page owns these styles in `src/views/marketing/marketing.scss`.
- The block is static, has no JavaScript lifecycle, and needs no image alt text because it uses text.
