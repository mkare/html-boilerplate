# Marketing kicker

Purpose: render the small decorative section label used by the Orbit marketing demo.

## Pug API

`+marketingKicker({ label, icon })`

- `label` is required text and is escaped by Pug.
- `icon` is optional decorative text; it defaults to `✦` and is hidden from assistive technology.
- The block has no JavaScript behavior or IDs, so it can be used more than once per page.
- It emits `.marketing-kicker` classes. The consuming page owns these styles in `src/views/marketing/marketing.scss`.
