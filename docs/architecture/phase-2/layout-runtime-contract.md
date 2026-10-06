# Phase 2 layout and runtime contract

## Layout selection

The page manifest is the single source for the `layout` local passed to Pug. `document.pug` owns metadata, locale and direction, the early color-scheme initializer, shared stylesheet order, the skip link, and the page content slot. The compatibility `base.pug` dispatches to a named shell file without requiring old Pug pages to change their `extends` statement.

| Manifest `layout` | Shell responsibility |
| --- | --- |
| `site` | Manifest-fed primary navigation, theme control, shared footer |
| `auth` | Home link and theme control; auth content owns the form composition |
| `dashboard` | Theme control; the dashboard page owns workspace navigation and tools |
| `storefront` | Shared manifest-fed navigation, theme control, shared footer |
| `docs` | Shared manifest-fed navigation, theme control, shared footer |
| `minimal` | Document metadata, skip link, content, and shared styles only |
| `agency` | Transitional minimal shell; Agency pages currently render their own navigation and footer |

Unknown layout and theme values fail manifest validation. Legacy records receive an explicit compatibility layout from `build/pages/legacy.cjs`; unknown values are not silently converted to `site`. Layout choice does not own page metadata or route generation. `pageId`, `route()`, and the navigation arrays remain build-provided values. The header reads `mainNavigation`; footer columns read `footerNavigation` and `blueprintNavigation`. Every internal destination is generated with `route(pageId)`, so layout templates do not maintain route lists or URL prefixes. Profile materialization may also pass `homePageId` and `demoBrand`; the shell uses them for the brand link and text, falling back to `legacy.home` and `Interface Kit` for legacy pages.

The current build adapter emits `layout` from `build/pages/legacy.cjs` or `page.json`. New pages must declare the most specific layout above. Agency's `agency` layout owns its navigation and footer inside page composition; it includes the same conditional locale switcher used by the shared header.

## CSS ownership and loading order

Each document links `core.scss`, `theme.scss`, and `layout.scss`, once and in that order. A page's own stylesheet follows in its `head` block. Page styles may use Sass-only values from `variables.scss`, but must not import `main.scss`, `core.scss`, `theme.scss`, or `layout.scss`. `main.scss` remains a compatibility aggregate and is not linked by a current layout.

`core.scss` owns Bootstrap's reduced foundation and global reset. `theme.scss` owns runtime semantic tokens, both brand presets, dark/light/system values, the Bootstrap CSS-variable bridge, and native `color-scheme`. `layout.scss` owns shell and cross-page UI styles. Each page stylesheet owns only that page's composition. The three shared files are emitted once and reused by each HTML document; no page entry recompiles the shared core.

Current compressed Sass measurements (raw / gzip, with Node's `zlib.gzipSync`) are core **27,150 / 5,963 bytes**, theme **4,463 / 1,088 bytes**, and layout **8,501 / 2,055 bytes**. The Bootstrap foundation itself is **25,094 / 5,381 bytes**. These are build artifacts, not a claim about transfer behavior on every host.

The current auth page styles still import their common auth partial into each auth page entry. That partial contains page-family styling and does not import core or the shared shell entries. Moving it into a separately owned auth stylesheet needs an auth-page ownership change because auth page SCSS is outside this session's source ownership.

## Color scheme and storage

The document initializer runs before stylesheet links. It resolves `system` through `prefers-color-scheme`, reads the versioned preference `interface-kit:color-scheme:v1`, and migrates a valid legacy `theme=light|dark` value only when no valid versioned value exists. Storage getters and operations are guarded because browser policy can deny access. A failed storage read or write does not prevent first paint or use of the current page's theme control.

The shell controller listens for OS preference changes only while the selected preference is `system`. An explicit `light` or `dark` selection remains in force when the OS changes. The controller also listens for cross-tab storage events, removes its listeners on `destroy()`, and can be mounted again. Old `body.theme-dark` pages are translated to the new root data attributes during migration. The old key and body selector are retained through 2027-10-03; their removal is reserved for version 2.0.0.

## Shell controller lifecycle

`mountShell(root, options)` owns all `[data-component="site-header"]` and `[data-component="site-footer"]` roots beneath its input. A component root is mounted once; mount functions return an idempotent `destroy()` handle. `mountHeader` owns the menu and theme interactions, while `mountStickyHeader` owns the observer and sentinel. Either controller cleans up independently. A menu is hidden only after the controller marks the header ready; without JavaScript, all manifest links remain visible and the menu toggle remains hidden.

Header navigation IDs are repaired at mount when multiple rendered instances would otherwise duplicate an ID. The matching `aria-controls` follows the repaired ID. Menu Escape closes the menu and returns focus to its toggle. Outside clicks and route-link clicks close it. Footer year markers use local data attributes rather than document-global IDs, so repeated footer instances do not collide.

With Node 22.23.2, run `node qa/phase-2/check-shell.cjs` after a build to check source contracts, controller behavior, and the generated shell. `--runtime-only` runs the source and interaction checks while skipping `dist/`, which is useful during concurrent profile builds.

## Fonts

Inter ships as local variable WOFF2 subsets under the SIL Open Font License. The Latin subset covers basic Latin; a small second subset covers Turkish-specific letters and shaping marks. Both use `font-display: swap`, and Webpack emits them with content hashes. The document preloads the Latin subset and preloads the Turkish subset only when `lang="tr"`. The stack falls back to platform sans-serif fonts, and no Google Fonts request is made. See `src/assets/fonts/README.md` for provenance, coverage, license, and sizes.
