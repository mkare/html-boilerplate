# Pagination

`uiPagination` renders a labeled `<nav>` containing page links, a current-page
marker, and optional unavailable previous/next markers. It does not fetch or
paginate collection data.

## Pug API

Include `@ui/molecules/pagination/pagination.pug`, then call
`+uiPagination(options)`. Both `label` and `items` are required. Unknown
top-level options and items without a text label or required destination throw
at build time.

| Option | Required | Default | Effect |
| --- | --- | --- | --- |
| `label` | Yes | — | Accessible name for the pagination `<nav>`. |
| `items` | Yes | — | Ordered item objects described below. |

Each item needs a string `label`. Set `href` for a navigable item; provide a
truthy `current` or `disabled` flag instead when it has no destination. A
current item renders as a `<span aria-current="page">`; a disabled item renders
as a `<span aria-disabled="true">`. If both flags are set, `current` takes
precedence in the template. Available items render as anchors with their
`href`.

There are no named variants or pagination state defaults. The page list,
current page, and disabled destinations come from the caller.

## Keyboard and focus

Available pages are native links and follow normal browser Tab, Enter, and
open-in-new-tab behavior. Current and disabled markers are spans, so they do
not receive keyboard focus. Focused links receive a 3px `:focus-visible`
outline from the component stylesheet.

## Theme hooks

The stylesheet reads `--color-text`, `--color-surface`, `--color-border`,
`--radius-sm`, `--color-on-accent`, `--color-accent`, and `--color-muted`.
Define these semantic tokens on an ancestor to adapt links, current-page state,
disabled state, and focus styling to the active theme.

## Integration

```pug
include @ui/molecules/pagination/pagination.pug

+uiPagination({
  label: "Article pages",
  items: [
    { label: "Previous", disabled: true },
    { label: "1", current: true },
    { label: "2", href: route('blog.archive.page2') },
    { label: "Next", href: route('blog.archive.page2') }
  ]
})
```

```scss
@use "@ui/molecules/pagination/pagination";
```

Use the collection's canonical URL policy when deciding whether page one has
a link. The working catalog example is in
`src/views/components/components.pug` under `#navigation`. The sample uses the
current SaaS page ID `blog.archive.page2`; replace it with a destination that
exists in the selected profile.
