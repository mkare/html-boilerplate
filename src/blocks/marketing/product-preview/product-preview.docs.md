# Marketing product preview

Purpose: create the decorative dashboard mockup used by the Orbit marketing hero.

## Pug API

`+marketingProductPreview(options)` accepts optional escaped strings: `workspace`, `avatar`, `shipped`, `focus`, `focusItem`, `research`, `insightCount`, `shipping`, `ready`, and `note`.

- Empty options use the Orbit demo copy.
- The illustration is decorative, so the caller wraps it in an `aria-hidden="true"` container.
- It contains no live controls or JavaScript and may be used more than once.
- It emits `.product-window*` and `.mini-card*` classes. The marketing page owns these styles in `src/views/marketing/marketing.scss`.
