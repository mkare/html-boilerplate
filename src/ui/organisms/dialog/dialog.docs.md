# Dialog

`mountDialogs` enhances native `<dialog>` elements marked with
`data-ui-dialog`. The module provides behavior only; it does not render markup
or ship a dialog stylesheet.

## Markup and JavaScript API

Give each dialog a unique `id`, `data-ui-dialog`, and an accessible name, usually
with `aria-labelledby` pointing to a visible heading. Put an `aria-controls`
reference to that ID on each opener. Openers must be buttons or elements with
`role="button"`, and both opener and dialog must be inside the mount root.

| API | Required | Default | Effect |
| --- | --- | --- | --- |
| `root` | No | `document` | Element or document searched for dialogs and openers. |
| `onClose` | No | — | Callback invoked as `onClose(dialog, opener)` after a dialog closes. |

There are no named variants. `mountDialogs(root, options)` returns an object
with `destroy()`. Mounting the same root again returns its existing instance;
destroying it removes listeners, closes open dialogs, and restores the
openers' original `aria-haspopup` values.

## Keyboard and focus

The module opens dialogs with the native `showModal()` method. Native modal
behavior contains Tab focus and closes on Escape. Initial focus moves to the
first matching `[data-dialog-initial-focus]`, enabled input, button, link, or
non-negative `tabindex` element. On close, focus returns to the opener. Use a
visible focus indicator in the consuming page's stylesheet.

## Theme hooks

The behavior module reads no CSS variables and owns no visual variants. Style
the `<dialog>` and `dialog::backdrop` in the page that uses it. The catalog
styles those selectors in `src/views/components/components.scss`, using
`--ui-ink`, `--ui-surface-raised`, `--ui-border`, `--ui-radius-lg`,
`--ui-shadow-float`, and `--ui-muted`; its backdrop color is currently a fixed
RGBA value. A project can map its own semantic theme tokens to these roles.

## Integration

```pug
button#open-settings(type="button", aria-controls="settings-dialog") Settings

dialog#settings-dialog(data-ui-dialog, aria-labelledby="settings-title")
  h2#settings-title Settings
  input(type="text", data-dialog-initial-focus, aria-label="Workspace name")
  form(method="dialog")
    button(type="submit", value="close") Close
```

```js
import { mountDialogs } from "@ui/organisms/dialog/dialog";

const dialogs = mountDialogs(document, {
  onClose(dialog, opener) {
    // Update application state if this dialog needs close handling.
  },
});

// Call dialogs?.destroy() when the mounted page or widget is removed.
```

The catalog has two live examples in `src/views/components/components.pug`
under `#overlays`; its page entry mounts the controller in
`src/views/components/components.js`.
