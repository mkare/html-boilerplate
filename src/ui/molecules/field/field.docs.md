# Field

`uiField` renders an explicit label, a native input, and an optional hint
connected with `aria-describedby`.

## Pug API

Include `@ui/molecules/field/field.pug`, then call `+uiField(options)`.
`id`, `name`, and `label` are required. `assertProps` rejects unknown options
and unsupported input types at build time. Give every field a unique `id`.

| Option | Required | Default | Accepted values or effect |
| --- | --- | --- | --- |
| `id` | Yes | — | Input ID and label's `for` value; also prefixes the hint ID. |
| `name` | Yes | — | Native form control name. |
| `label` | Yes | — | Visible label text. |
| `type` | No | `text` | `text`, `email`, `password`, `search`, `tel`, or `url`. |
| `autocomplete` | No | — | Native `autocomplete` value. |
| `placeholder` | No | — | Optional input placeholder; it does not replace the label. |
| `hint` | No | — | Optional helper text with ID `{id}-hint`, referenced by the input. |
| `required` | No | `false` | Sets the native required state. |

There are no named variants. The current API has no error-message or validation
props; connect application validation separately and keep its accessible
message associated with the control.

## Keyboard and focus

The rendered input keeps native keyboard and form behavior. The component
stylesheet applies a border change and a 3px `:focus-visible` outline when the
input receives keyboard focus. Native `required` validation is enabled only
when `required: true`.

## Theme hooks

The stylesheet reads `--color-text`, `--color-surface`, `--color-border`,
`--radius-sm`, `--color-accent`, `--color-danger`, and `--color-muted`.
Override these semantic tokens on the field or an ancestor to theme the label,
input, focus state, and hint.

## Integration

```pug
include @ui/molecules/field/field.pug

form(method="post")
  +uiField({
    id: "contact-email",
    name: "email",
    label: "Email address",
    type: "email",
    autocomplete: "email",
    hint: "We will use this to reply.",
    required: true
  })
  button(type="submit") Send
```

```scss
@use "@ui/molecules/field/field";
```

Add the application's form action and server-side validation to the form; this
component only renders the control and its optional hint.

The shared field examples are in `src/views/components/components.pug` under
`#forms`.
