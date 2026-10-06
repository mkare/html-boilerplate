# Button

`uiButton` renders a native `<button>` with the shared `ui-button` classes. Use
it for an action; use an anchor for navigation.

## Pug API

Include `@ui/atoms/button/button.pug`, then call `+uiButton(options)`. `label` is
required. `assertProps` rejects unknown top-level options and unsupported enum
values at build time. The mixin forwards native Pug call attributes to the
button after applying the options below. Pug merges a forwarded `class` with
the component classes. If a forwarded attribute has the same name as an
option-backed attribute, the forwarded value wins: for example, call-site
`type` overrides the `type` option, and call-site `disabled` overrides the
`disabled` option. Use these call attributes only when the consuming template
intends to take precedence over the component options.

| Option | Required | Default | Accepted values or effect |
| --- | --- | --- | --- |
| `label` | Yes | — | Button text, rendered as escaped text. |
| `variant` | No | `primary` | `primary`, `secondary`, `ghost`, `danger`; adds `ui-button--{variant}`. |
| `size` | No | `md` | `sm`, `md`, `lg`; adds `ui-button--{size}`. |
| `type` | No | `button` | Native `button`, `submit`, or `reset`. |
| `disabled` | No | `false` | Sets the native disabled state. |
| `ariaLabel` | No | — | Sets `aria-label`; use when the visible label does not name the action. |
| `actionMessage` | No | — | Adds the catalog demo's `data-demo-*` attributes. It does not implement an application action. |

## Keyboard and focus

The native button supports Enter and Space. A disabled button is removed from
the tab order by the browser. The component stylesheet gives enabled buttons a
3px `:focus-visible` outline and respects `prefers-reduced-motion`.

## Theme hooks

The stylesheet reads `--color-on-accent`, `--color-accent`,
`--color-accent-strong`, `--color-surface-subtle`, `--color-text`,
`--color-border`, `--color-danger`, `--color-focus`, and `--radius-sm`, with
fallbacks where defined. Set these semantic tokens on the component's theme
scope; the size and variant classes remain available for local overrides.

## Integration

```pug
include @ui/atoms/button/button.pug

form(method="post")
  +uiButton({ label: "Save changes", variant: "primary", type: "submit" })
```

```scss
@use "@ui/atoms/button/button";
```

The catalog demonstrates all four variants and the disabled state in
`src/views/components/components.pug` under `#actions`.
