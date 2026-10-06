# Toast

`mountToast` enhances one existing live-region element. It does not render the
region, choose its visual placement, or move focus.

## Markup and JavaScript API

Keep an empty region in the page and give it an appropriate live announcement
role before mounting. The controller writes messages with `textContent`, so
message strings are announced as text rather than interpreted as HTML.

| API | Required | Default | Effect |
| --- | --- | --- | --- |
| `root` | Yes | — | Existing element whose text, `hidden`, class, and `data-state` are managed. |
| `show(message, options)` | Yes | — | Displays a non-empty message, replacing any pending message. |
| `options.duration` | No | `3600` ms | Delay before hiding the message. |
| `options.state` | No | `status` | Value written to `root.dataset.state` for application styling. |

There are no built-in variants or allowed `state` values. `mountToast(root)`
returns `{ show, destroy }`; mounting the same root again returns the existing
controller. `destroy()` cancels timers and animation frames, clears the text,
and hides the region. Empty messages are ignored.

## Keyboard and focus

A toast is a live announcement, not an interactive control. The controller does
not take or move focus and adds no keyboard behavior. Keep actions and important
errors in the page near the task instead of putting controls in a toast. The
catalog region uses `role="status"`, `aria-live="polite"`, and
`aria-atomic="true"`.

## Theme hooks

The controller only sets `data-state`; it reads no CSS variables and ships no
stylesheet. Use that attribute to select application-specific status styles.
The catalog's `.docs-toast` rule in `src/views/components/components.scss`
uses `--ui-radius-sm`, `--ui-shadow-float`, and `--ui-transition`; its text,
background, and border colors are currently fixed values.

## Integration

```pug
output#site-toast(role="status", aria-live="polite", aria-atomic="true", hidden)
```

```js
import { mountToast } from "@ui/organisms/toast/toast";

const toast = mountToast(document.getElementById("site-toast"));
toast?.show("Your changes were saved.");
toast?.show("A temporary notice", { duration: 5000, state: "notice" });

// Call toast?.destroy() when the page or widget is removed.
```

The live example and its event wiring are in
`src/views/components/components.pug` and
`src/views/components/components.js` under `#overlays`.
