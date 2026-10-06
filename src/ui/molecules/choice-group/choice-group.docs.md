# Checkbox and radio group

`uiChoiceGroup` renders a native `<fieldset>` with a visible `<legend>`,
checkboxes or radios, associated labels, and optional group help. Native keyboard
and submission behavior remain intact.

## Pug API

Include `@ui/molecules/choice-group/choice-group.pug`, then call
`+uiChoiceGroup(options)`. Each item has a unique string `value`, a visible
`label`, and optional boolean `checked`, `disabled`, or `required`.

| Option | Required | Default | Accepted values or effect |
| --- | --- | --- | --- |
| `idPrefix` | Yes | — | Starts with a letter; generates stable IDs for each item and hint. |
| `name` | Yes | — | Shared native name for submitted controls. |
| `legend` | Yes | — | Visible group label. |
| `type` | Yes | — | `checkbox` or `radio`. |
| `items` | Yes | — | Non-empty list of `{ value, label, checked?, disabled?, required? }`. |
| `hint` | No | — | Group help connected to the fieldset with `aria-describedby`. |
| `orientation` | No | `vertical` | `vertical` or `horizontal` layout. |
| `disabled` | No | `false` | Disables the fieldset's controls. |
| `required` | No | `false` | Requires one selection for a radio group. For checkboxes, set `required` only on the individual item that is mandatory. |

Radio groups accept at most one initially checked item. Choice values must be
unique. Give every group a distinct `idPrefix`.

## Keyboard and focus

The browser provides native checkbox and radio keyboard behavior. Each complete
label row is at least 44px high. Inputs keep native appearance and receive a
visible focus outline.

## Theme hooks

The group uses `--color-text`, `--color-muted`, `--color-surface-subtle`,
`--color-accent`, and `--radius-sm`, with fallbacks.

## Integration

```pug
include @ui/molecules/choice-group/choice-group.pug

+uiChoiceGroup({
  idPrefix: 'contact-updates',
  name: 'updates',
  legend: 'Updates',
  type: 'checkbox',
  items: [{ value: 'product', label: 'Product notes' }, { value: 'events', label: 'Event invitations' }],
  hint: 'Choose any that you would like to receive.'
})
```

Import `@ui/molecules/choice-group/choice-group.scss` and keep group names,
required choices, and server validation in the page or form owner.
