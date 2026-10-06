# Customization and file ownership

The framework release contains shared layouts, UI, themes, build rules, and demo source. A customer project should keep changes that belong to the customer separate from those framework-owned defaults so an update can replace the framework files without erasing customer decisions.

## Ownership map

| Area | Typical files | Owner and upgrade treatment |
| --- | --- | --- |
| Build/runtime contract | `webpack.config.js`, `build/**`, `config/**`, package metadata | Framework-owned. Avoid direct edits in a customer branch; carry required patches explicitly until they become a supported extension. |
| Shared shell and UI | `src/layouts/**`, `src/components/**`, `src/ui/**`, shared `src/scss/**` | Framework-owned. Rebase custom behavior rather than replacing the whole directory. |
| Demo defaults | `src/pages/agency/**`, `src/pages/saas/**`, their shared content and page styles | Framework-owned demo content. A customer can fork/copy a page into a customer-owned page path and keep the edit in their project overlay. |
| New customer page | `project/overrides/pages/<page>/{page.json,page.pug,page.scss}` | Customer-owned addition. Override page JSON is validated and discovered for the selected demo. Keep its ID and route unique; use `route(pageId)` for internal links. |
| Customer blocks | `src/blocks/<customer>/**` | Customer-owned additions. Keep Pug API docs beside each block and put presentation rules in the owning page or an explicitly linked stylesheet. |
| Static media | `public/<customer>/**` | Customer-owned additions copied into the output as-is. Use an asset helper or a Pug asset import for emitted page references. |
| Release/build output | `.generated/**`, `dist/**`, release ZIP | Generated and disposable. Never use these as the source of customer edits. |

Keep the customer overlay outside the framework-owned source tree when the app is maintained as a separate project. The loader reads this project-owned overlay:

```text
project/overrides/
├── brand.json
├── theme.json
├── navigation.json
├── custom.scss
└── pages/<customer-page>/{page.json,page.pug,page.scss}
```

Track override files directly in the separate project overlay through the app's source-control workflow. Do not use symlinks in the overlay or copy it over `src/**` during a framework update.

## Project overrides

The optional `project/overrides/` directory contains customer-owned files. It is read at build/configuration time and included in the isolated release source copy when present.

```text
project/overrides/
├── brand.json
├── theme.json
├── navigation.json
├── custom.scss
└── pages/<customer-page>/{page.json,page.pug,page.scss}
```

Brand and logo:

```json
{
  "name": "Northstar Studio",
  "logo": "customer/brand.svg"
}
```

`logo` is relative to `public/`; keep the file under that directory. The shared header and footer render this brand for the selected demo. Without `brand.json`, Agency uses `Fieldwork` and SaaS uses `Orbit`. Brand text is escaped in Pug.

Public semantic token overrides use theme and color-scheme names. Only the documented token allowlist is accepted; values that can introduce new CSS rules, URLs, or imports are rejected.

```json
{
  "themes": {
    "default": {
      "light": { "--color-accent": "#145f59" },
      "dark": { "--color-accent": "#75d6c9" }
    }
  }
}
```

Navigation refers to manifest page IDs, never hand-written internal URLs:

```json
{
  "items": [
    { "pageId": "saas.features", "label": "Capabilities", "groups": ["main", "footer"], "order": 10 },
    { "pageId": "saas.faq", "hidden": true }
  ],
  "external": [
    { "id": "social.linkedin", "label": "LinkedIn", "href": "https://www.linkedin.com/company/example/" }
  ]
}
```

`groups` accepts `main`, `footer`, and `blueprint`. An item can relabel, reorder, move, add, or hide a known active page; page IDs resolve through `route(pageId)` after profile filtering and demo mounting. Unknown or inactive page IDs are ignored with a warning. External links must be absolute HTTPS URLs. If `navigation.json` is absent, page-record navigation and the default social links remain active.

`custom.scss` is checked with Sass and compiled by Webpack into a generated stylesheet. Its generated link follows core, theme, layout, and page CSS, so it can override any earlier style. It is loaded only on the selected demo's pages. Use local Sass modules under `project/overrides/` or Sass built-ins; do not edit `.generated/` artifacts.

Custom pages go under `project/overrides/pages/`. Their source, styles, scripts, and data paths must remain inside that page tree; symlinks and paths outside the project are rejected. If `demoId` is omitted, the record attaches to `BUILD_DEMO` (default `saas`). A supplied `demoId` must match the selected demo. Use a unique ID and a non-home route; a route or ID collision is skipped with a warning and does not replace a framework page. A valid page JSON record follows the normal page schema. Internal links use `route('customer.page-id')`, which applies the selected demo mount and `BASE_PATH`.

Each optional configuration file falls back independently when it is missing or invalid: bad brand data keeps the demo default, bad theme data emits no project token stylesheet, bad menu data keeps the default menu, and bad Sass is omitted. An invalid custom page record is skipped. Warnings identify the ignored file. Development mode watches override additions, edits, repairs, and removals and rebuilds its configuration.

## Local font customization

Keep your redistributable WOFF2 font and its license under `public/customer/fonts/`, and declare it in `project/overrides/custom.scss`. The custom-Sass loader accepts `@font-face`; the URL restrictions for `theme.json` token values do not apply to Sass font declarations. For a normal-style, regular-weight file:

```scss
@font-face {
  font-family: "Customer Sans";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("../../public/customer/fonts/BrandSans.woff2") format("woff2");
}

html[data-theme] {
  --font-family-sans: "Customer Sans", system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;
}
```

The URL is a build-time source reference relative to the two-level override directory. CSS resolution emits a hashed copy under `assets/fonts/` and applies the configured asset base. Do not replace it with a literal `/customer/fonts/...` URL: root-relative URLs enter the CSS resolver, and a hardcoded origin-root path also ignores a deployment subpath. Verify the emitted CSS URL and font request after both root and `BASE_PATH=/preview/theme/` builds. Keep project Sass in the documented override location.

Set weight, style and any `unicode-range` to the actual file; add a separate face for each static weight/style, or declare the genuine variable range. Include all characters the real content needs, including Turkish glyphs when applicable. A subset range describes its existing glyphs; it does not supply missing ones. Keep the fallback stack and `font-display: swap`; check long-copy reflow and layout shifts. The shared token changes body/UI text. Explicit page-family fonts, such as Agency's Georgia display text, remain their own styles and need a scoped project selector if they should also change.

The document still preloads framework Inter Latin and conditionally its Turkish subset from the page locale. A project `@font-face` does not change that preload policy or remove Inter from the bundle; do not claim the new font is preloaded. Public files are also copied as-is, so this public-source example leaves both the original font and hashed CSS asset in the output. Both count toward the 120 KiB raw release font inventory cap, together with Inter; choose subsets that fit and run the release budget check. For a single additional file, the public-copy duplication means its bytes count twice. Keep the font license with the public files, retain provenance and review redistribution rights; the dependency license inventory does not establish a newly supplied font's license.

## Override precedence

The data-priority contract specifies this order for fields that have a live source at each layer:

```text
site defaults → theme → demo → page/page variant → project custom override
```

Project tokens and custom Sass load after the selected page stylesheet. Brand values apply to the selected demo, navigation modifications apply only to active manifest pages, and custom pages participate in profile filtering and route generation. Existing framework routes remain framework-owned: a project page cannot replace the selected home or system 404, and collisions are reported and skipped.

## Migration rehearsal boundary

`node qa/release/rehearse-upgrade.cjs` creates an isolated application with an installed framework loader, loads a real project overlay, replaces framework version 1.0.0 with 1.1.0, then uses the production loader again to read the same brand, logo, theme tokens, navigation, custom page, and Sass. It also compares each project-owned file's SHA-256 before and after replacement. `node qa/overrides/check-project-overrides.cjs` verifies that the same loader compiles the overlay into production HTML, CSS, and assets, and that malformed input falls back safely.
