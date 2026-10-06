# Alert

`uiAlert` renders a text-first status message. Non-error variants use a polite
status announcement; the error variant uses an assertive alert. It has no
dismissal or JavaScript behavior.

## Pug API

Include `@ui/molecules/alert/alert.pug`, then call `+uiAlert(options)`. The
`message` is required. Unknown options and variants are rejected by
`assertProps`.

| Option | Required | Default | Accepted values or effect |
| --- | --- | --- | --- |
| `message` | Yes | — | Visible status text, rendered as escaped text. |
| `title` | No | — | Optional visible heading before the message. |
| `variant` | No | `info` | `info`, `success`, `warning`, or `error`; also selects the live-region role and politeness. |
| `icon` | No | — | Optional decorative text symbol, hidden from assistive technology. |

## Keyboard and focus

Alerts are static content and are not focusable. Place a changing status near
the control or content it describes; do not move focus for a routine update.

## Theme hooks

Variants use `--color-accent`, `--color-accent-strong`, `--color-positive`,
`--color-warning`, `--color-danger`, `--color-surface`, `--color-border`, and
`--radius-md`, with fallbacks. Text states the message so meaning is not
conveyed by color alone.

## Integration

```pug
include @ui/molecules/alert/alert.pug

+uiAlert({ variant: 'success', title: 'Saved', message: 'Your settings were saved.' })
```

Import `@ui/molecules/alert/alert.scss`. The page or controller owns when a
dynamic alert is inserted and when it should be removed.
