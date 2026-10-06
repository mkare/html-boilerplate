# Marketing stats

Purpose: render a semantic list of proof points or other concise marketing metrics.

## Pug API

`+marketingStats([{ value, label }])`

- Supply at least one item; every item needs non-empty `value` and `label` strings.
- Both strings are escaped by Pug. The block renders a `<dl>` with one `<dt>` and `<dd>` per item.
- The block has no JavaScript behavior or generated IDs, so it can appear more than once on a page.
- It emits `.marketing-stats`. The consuming page owns its styling in `src/views/marketing/marketing.scss`.
