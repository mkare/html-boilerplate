# Disclosure

`uiDisclosure` renders native `<details>` and `<summary>` markup. Its expanded
state works without JavaScript.

## Pug API

Include `@ui/molecules/disclosure/disclosure.pug`, then call
`+uiDisclosure(options)` and put the disclosed content in the mixin block.
`assertProps` rejects unknown options at build time.

| Option | Required | Default | Effect |
| --- | --- | --- | --- |
| `summary` | Yes | — | Visible label inside the native `<summary>`. |
| `open` | No | `false` | Adds the native `open` attribute when true. |
| `id` | No | — | Sets the `<details>` element ID. |

There are no named variants. The content block is optional and is rendered
inside `.ui-disclosure__content` when provided.

## Keyboard and focus

The browser's native disclosure control toggles with Enter or Space and
reports its expanded state to assistive technology. The summary is keyboard
focusable and receives a 3px `:focus-visible` outline from the component
stylesheet. No JavaScript controller or extra ARIA state is needed.

## Theme hooks

The stylesheet reads `--color-border`, `--radius-md`, `--color-surface`,
`--color-text`, `--color-focus`, `--color-accent`, and `--color-muted`. Define
these semantic tokens on the disclosure or an ancestor to match a brand or
color scheme.

## Integration

```pug
include @ui/molecules/disclosure/disclosure.pug

+uiDisclosure({ summary: "Why use native disclosure?", id: "disclosure-help" })
  p The browser supplies the expanded state and keyboard interaction.
```

```scss
@use "@ui/molecules/disclosure/disclosure";
```

The live catalog example is in `src/views/components/components.pug` under
`#navigation`.
