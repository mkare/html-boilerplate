# Tabs

`mountTabs` enhances tab markup inside a document or element root. It does not
render the tabs or provide their CSS. Keep the selected tab and its panel
usable in the initial HTML so the page has a sensible no-JavaScript state.

## Markup and JavaScript API

Use a `role="tablist"` containing button tabs. Each tab needs a
`data-tab="panel-id"` or `aria-controls="panel-id"` reference to an existing
panel ID. Mark the initial tab with `aria-selected="true"`, give the matching
panel visible content, and set other panels `hidden`. Keep IDs unique across
all tab groups in the document. The controller fills in tab IDs when missing
and assigns panel relationships.

| API | Required | Default | Effect |
| --- | --- | --- | --- |
| `root` | No | `document` | Searches this root for tab lists and panels. |
| `idPrefix` | No | `root.dataset.idPrefix` or generated prefix | Prefix for controller-generated IDs. |

There are no named variants. `mountTabs(root, options)` returns an object with
`destroy()`. Mounting the same root again returns the existing instance;
destroying it removes listeners and restores the attributes and classes the
controller changed. An invalid or unmatched panel reference is skipped.

## Keyboard and focus

Tabs use automatic activation: Left and Right Arrow move and activate tabs in a
horizontal list; Up and Down Arrow do so when the tablist has
`aria-orientation="vertical"`. Navigation wraps at either end. Home and End
move to the first and last tab. Arrow/Home/End movement also moves focus and
updates the roving `tabindex`; button Enter and Space activate through native
click behavior. A panel can be activated from a URL hash that matches its ID.
The controller does not add a focus outline; provide a visible `:focus-visible`
style in the owning page.

## Theme hooks

The controller reads no CSS variables and has no theme variants. The live
catalog styles `.component-tabs`, `.tab-button`, and `.tab-panel` in
`src/views/components/components.scss`, using `--ui-border`, `--ui-muted`,
`--ui-accent-strong`, and `--ui-accent`. A consuming page owns equivalent
layout, selected-state, panel, and focus styles and can map those roles to its
theme tokens.

## Integration

```pug
section(data-account-tabs, data-id-prefix="account")
  div(role="tablist", aria-label="Account settings")
    button#account-profile-tab(type="button", role="tab", aria-selected="true", aria-controls="account-profile-panel") Profile
    button#account-security-tab(type="button", role="tab", aria-selected="false", aria-controls="account-security-panel", tabindex="-1") Security
  #account-profile-panel(role="tabpanel", aria-labelledby="account-profile-tab") Profile settings
  #account-security-panel(role="tabpanel", aria-labelledby="account-security-tab", hidden) Security settings
```

```js
import { mountTabs } from "@ui/organisms/tabs/tabs";

const tabs = mountTabs(document.querySelector("[data-account-tabs]"), {
  idPrefix: "account",
});

// Call tabs?.destroy() when the widget is removed.
```

The catalog shows two independent tab groups under `#actions` in
`src/views/components/components.pug`; the controller is mounted by its page
entry in `src/views/components/components.js`.
