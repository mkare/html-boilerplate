# Card

`uiCard` is a semantic `<article>` with a fixed level-three title, optional
eyebrow and description, and an optional Pug content block. The card itself is
not interactive; put separate links or buttons inside its content when needed.

## Pug API

Include `@ui/molecules/card/card.pug`, then call `+uiCard(options)`. `title` is
required. The title renders as an `<h3>`; make sure that level fits the
surrounding page outline.

| Option | Required | Default | Accepted values or effect |
| --- | --- | --- | --- |
| `title` | Yes | — | Visible level-three heading. |
| `eyebrow` | No | — | Short visible context label before the title. |
| `description` | No | — | Escaped supporting text below the title. |
| `variant` | No | `plain` | `plain`, `muted`, or `raised` surface treatment. |

## Keyboard and focus

The card is not focusable unless its content contains interactive controls. Its
native article structure groups related information without adding landmark or
tab stops.

## Theme hooks

The card reads `--color-text`, `--color-surface`, `--color-surface-subtle`,
`--color-border`, `--color-muted`, `--color-accent-strong`, `--radius-md`, and
`--shadow-card`, with fallbacks.

## Integration

```pug
include @ui/molecules/card/card.pug

+uiCard({ title: 'Release notes', eyebrow: 'Documentation', description: 'Changes included in this release.' })
  a(href=route('docs.release')) Read the release notes
```

Import `@ui/molecules/card/card.scss` from the page stylesheet. The page owns
card grid placement and heading-level decisions around the component.
