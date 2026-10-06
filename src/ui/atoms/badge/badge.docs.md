# Badge

`uiBadge` presents a short, non-interactive status or category label. Its text
remains visible without color or JavaScript.

## Pug API

Include `@ui/atoms/badge/badge.pug`, then call `+uiBadge(options)`. `label` is
required and escaped. `assertProps` rejects unknown properties and variants.

| Option | Required | Default | Accepted values or effect |
| --- | --- | --- | --- |
| `label` | Yes | — | Visible badge text. |
| `variant` | No | `neutral` | `neutral`, `info`, `success`, `warning`, or `danger`. |
| `dot` | No | `false` | Adds a decorative dot hidden from assistive technology. |

## Keyboard and focus

The badge is static text and is not focusable. Do not use it as a button or link.

## Theme hooks

The variants use semantic `--color-*` tokens for text, surface, and border.
Each token has a fallback, and the visible label carries the status meaning.

## Integration

```pug
include @ui/atoms/badge/badge.pug

+uiBadge({ label: 'Published', variant: 'success', dot: true })
```

Import `@ui/atoms/badge/badge.scss` from the consuming page stylesheet.
