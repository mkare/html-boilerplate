# Select

`uiSelect` renders a native select with a visible label and optional associated
hint. It does not replace the browser's native selection and form behavior.

## Pug API

Include `@ui/molecules/select/select.pug`, then call `+uiSelect(options)`. The
`id`, `name`, `label`, and non-empty `options` array are required. Each option
has a unique non-empty string `value`, a visible `label`, and optional boolean
`disabled`.

| Option | Required | Default | Accepted values or effect |
| --- | --- | --- | --- |
| `id` | Yes | — | Starts with a letter; used by the label and hint relationship. |
| `name` | Yes | — | Native form field name. |
| `label` | Yes | — | Visible control label. |
| `options` | Yes | — | Non-empty list of `{ value, label, disabled? }` records with unique values. |
| `value` | No | — | Selected option value; must exist in `options`. |
| `placeholder` | No | — | Empty first option; disabled when the select is required. |
| `hint` | No | — | Helper text connected with `aria-describedby`. |
| `required` | No | `false` | Sets native required validation. |
| `disabled` | No | `false` | Sets the native disabled state. |

## Keyboard and focus

The native select retains platform keyboard, option navigation, and form
validation. The control has a 44px minimum height and visible `:focus-visible`
outline.

## Theme hooks

The label, control, hint, and focus state use semantic `--color-*` and
`--radius-sm` tokens with fallbacks.

## Integration

```pug
include @ui/molecules/select/select.pug

+uiSelect({
  id: 'contact-topic',
  name: 'topic',
  label: 'Topic',
  placeholder: 'Choose a topic',
  options: [{ value: 'design', label: 'Design' }, { value: 'accessibility', label: 'Accessibility' }],
  hint: 'Choose the topic closest to your question.',
  required: true
})
```

Import `@ui/molecules/select/select.scss` in the consuming page. Add application
validation and form submission separately.
