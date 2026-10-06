# Link

`uiLink` renders a native anchor with visible text and an inline arrow hidden
from assistive technology. Use it for navigation; use `uiButton` for an action.

## Pug API

Include `@ui/atoms/link/link.pug`, then call `+uiLink(options)`. The mixin
requires a non-empty `href` and visible `label`, escapes the visible label, and
rejects unsafe schemes, protocol-relative URLs, malformed or credentialed HTTP
URLs, control characters, and backslashes.

| Option | Required | Default | Accepted values or effect |
| --- | --- | --- | --- |
| `href` | Yes | — | Safe relative path, fragment, `http:`, `https:`, `mailto:`, or `tel:` URL. |
| `label` | Yes | — | Visible anchor text, rendered as escaped text. |
| `ariaLabel` | No | — | Non-empty accessible name; use only when the visible label does not fully name the destination. |

## Keyboard and focus

The native anchor is reached with Tab and activated with Enter. The stylesheet
provides a 44px minimum target and a visible `:focus-visible` outline.

## Theme hooks

The component reads `--color-accent-strong`, `--color-focus`, and
`--color-accent`, with fallbacks. It respects `prefers-reduced-motion` for its
decorative arrow.

## Integration

```pug
include @ui/atoms/link/link.pug

+uiLink({ href: route('saas.features'), label: 'Explore features' })
```

The page owns route selection and supplies `route(pageId)` for internal links;
the component validates but does not resolve route IDs. For external
destinations, provide a complete `https://` URL; the component does not set a
new browsing context. The consuming page imports
`@ui/atoms/link/link.scss` and owns any page-specific layout around the link.
