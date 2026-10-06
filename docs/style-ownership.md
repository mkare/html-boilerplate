# Style and theme ownership

The shared Pug layout links CSS in this order: `core.scss`, `theme.scss`, `layout.scss`, then the page stylesheet in that page's `block head`. A consumer override may be linked after the page stylesheet. Each shared entry is compiled once and referenced by every page; page styles never import `main.scss`.

| Source | Owns | Loaded by |
| --- | --- | --- |
| `src/scss/core.scss` | Bootstrap foundation, project reset, global focus and base primitives | `src/layouts/base.pug` |
| `src/scss/theme.scss` | Semantic colors, Bootstrap CSS-variable bridge, color-scheme values, font stacks | `src/layouts/base.pug` |
| `src/scss/layout.scss` | Site header/footer and shared UI primitives, forms, data display, and feedback styles | `src/layouts/base.pug` |
| `src/views/<page>/*.scss` | Page composition and styles used only by that page | The page's Pug `block head` |
| `src/scss/main.scss` | Compatibility aggregate for older consumers | Not loaded by current pages |

`variables.scss` contains Sass build values only. It emits no CSS. A page stylesheet that needs those values starts with `@use "@scss/variables" as *;`; this imports compile-time constants without copying core, theme, or layout CSS into the page output. Shared styles currently repeat only where an auth page imports its shared auth partial; extracting that family into its own layout is a later migration.

## Bootstrap surface

The retained Bootstrap Sass modules are `reboot`, `containers`, `grid`, and `nav`, with the functions, variables, maps, mixins, and root definitions they require. The templates use `.container`, `.nav`, `.nav-link`, and `.nav-item`. `list-unstyled` and `my-0` are small project utilities in `base.scss`; Bootstrap's generated utilities API and helpers are not loaded. Bootstrap JavaScript is not included. `yarn check:bootstrap-classes` scans parsed Pug class attributes and rejects recognized Bootstrap utility/helper classes outside the retained surface with a file, line, and class name. `yarn lint` runs this check, so it is part of `yarn ci:build`. The check intentionally ignores component names such as `.form-control` that the project may own, and checks static class literals rather than classes constructed at runtime.

The semantic tokens in `theme.scss` bridge into Bootstrap's `--bs-*` properties, including color and RGB values, links, borders, focus rings, and form validation. The `default` and `commerce` brand presets share that token contract in both schemes. `html[data-bs-theme]` follows the resolved scheme. Native form controls use `color-scheme` from the same resolved state.

The reduced Bootstrap surface measures **25,094 bytes raw / 5,381 bytes gzip** (`sass --style=compressed`, then Node `zlib.gzipSync`). The recorded baseline for `custom-bootstrap.scss` was **103,987 / 14,845 bytes**, so the Bootstrap surface gzip fell by about **63.7%**. The full `core.scss` entry, including project foundation styles, is **27,158 / 5,990 bytes** by the same method. Shared entry measurements before page styles are core **5,990**, theme **1,058**, and layout **2,026** gzip bytes.

## Font policy

The framework ships local Inter variable WOFF2 subsets under the SIL Open Font License. The Latin file serves the basic Latin range and the small second subset contains Turkish-specific letters and shaping marks. Both use `font-display: swap`; the platform sans stack remains the fallback. The CSS references the files directly so Webpack hashes and emits them with other media assets. The Latin file is preloaded by the document shell; the Turkish subset is preloaded only for Turkish pages. No Google Fonts request is made. See `src/assets/fonts/README.md` for source, coverage, license, and byte sizes.

## Color-scheme storage and legacy migration

- The current preference key is `interface-kit:color-scheme:v1`; values are `light`, `dark`, or `system`.
- The first-party inline script in `base.pug` reads storage before stylesheets, resolves `system` with `prefers-color-scheme`, and sets `data-color-scheme`, `data-color-scheme-preference`, and `data-bs-theme` on `html`.
- Storage access is wrapped in `try/catch`. If it is unavailable, the layout still renders and the theme control still updates the current page.
- When the current key has no valid value, `theme=light|dark` is read once and moved to the versioned key. The old key is deleted only after a successful write. A valid current key takes precedence and causes the old key to be removed.
- Existing `body.theme-dark` documents are supported during migration. The shared stylesheet retains a compatibility selector; the shell controller transfers that state to `html[data-color-scheme="dark"]` and removes the body class when it mounts.
- The old storage-key reader and `body.theme-dark` selectors are scheduled for removal no earlier than **2027-10-03**, in version **2.0.0**. Until then, new code writes only the versioned key and sets theme state on `html`.
- A strict CSP must authorize the exact emitted inline initializer with a hash or nonce. A release builder should derive the hash from the generated HTML bytes, after any HTML minification.

The menu links remain visible when JavaScript is unavailable. The menu and theme controls are shown only after the shell controller has attached their behavior.
