# Browser support and verification

The framework targets modern browsers selected by the checked-in `.browserslistrc`:

```text
> 0.2%
last 2 versions
Firefox ESR
not dead
not op_mini all
```

These queries form the CSS compatibility target; they do not certify every selected browser. Resolve the current list with `yarn browserslist` using the locked dependency tree. The list can change when Browserslist/caniuse data changes; review that separately from runtime support. Autoprefixer uses this shared list for generated CSS, and `yarn check:autoprefixer` verifies the configuration and representative prefixes.

## JavaScript and platform requirements

The project has no Babel/SWC syntax transpilation or general polyfill layer. Production minimization is not transpilation. Runtime code uses modern syntax such as optional chaining/nullish coalescing and browser APIs including `URL`, `Intl.NumberFormat`, `AbortController`/abortable event listeners, `CSS.escape`, and native `dialog.showModal()`. Component and auth enhancement require those APIs; the dialog controller skips modal opening when `showModal` is absent rather than installing a dialog polyfill. A custom connected auth adapter also needs `fetch`; the built-in demonstration adapter does not send credentials.

CSS uses custom properties, logical sizing, `clamp()` and `color-mix()`. Vendor prefixing does not supply missing CSS implementations. When a project needs an older engine, inspect its actual page/component requirements and add an explicitly owned syntax/API/CSS compatibility layer with acceptance evidence; changing the Browserslist queries alone is insufficient.

## Implemented fallback boundaries

| Capability | Current behavior |
| --- | --- |
| JavaScript disabled or shell unavailable | The HTML content and native links/pagination remain; the shared menu is visible without enhancement. Demo forms remain disabled with a static explanation. Interactive-only examples still need JavaScript. |
| Storage denied | Theme operations are guarded; the page still works. Cart additions remain in memory and report visit-only storage. |
| System color preference | `matchMedia` is used when available; preference resolution falls back to light on failure. Explicit theme choices persist when storage permits. |
| Sticky-header observer | The controller checks `IntersectionObserver`; the optional sticky effect is omitted when unavailable. |
| Animation frame | Toast reveal uses a timeout when `requestAnimationFrame` is unavailable. |
| Font download unavailable | `font-display: swap` and the platform fallback stack preserve readable text. |

These are code-level fallback contracts, not a promise that an engine unable to parse the shipped JavaScript can run its controllers. The header's local fallback for a missing `AbortController` does not remove that requirement from other components.

## Evidence and release checklist

The [status ledger](../FRAMEWORK_IMPLEMENTATION_STATUS.md) records the latest isolated headless Chromium **153.0.8010.12** matrix in [`visual-report.json`](../../qa/framework-status-2026-10-06/browser-remediated/visual-report.json): nine representative routes × 320/768/1440 CSS px × light/dark (**54 observations**). It found no horizontal overflow, sampled text contrast failures, or targets below the measured 24×24 minimum and separate 44×44 project target. The run also covered selected theme transitions, commerce flows, and six component-catalog snippet-parity checks. The separate Axe report scanned all 52 catalog-preview routes in both schemes (**104 scans**): zero violations, with 144 incomplete items requiring manual review. This bounded evidence does not establish complete browser coverage, assistive-technology support, or WCAG conformance.

## Running the dated browser matrix

The visual acceptance runner uses the pinned local `playwright` development dependency. Install the matching Playwright Chromium browser once per machine, then build and serve the catalog preview in separate terminals:

```sh
yarn install --frozen-lockfile
yarn playwright install chromium
yarn build:preview
yarn preview
```

The preview server prints its local URL (by default `http://localhost:4173/`). In another terminal, pass a loopback URL ending in `/`:

```sh
yarn qa:visual-acceptance http://127.0.0.1:4173/
```

Run the manifest-wide axe-core scan against the same catalog preview with:

```sh
yarn qa:axe http://127.0.0.1:4173/
```

It scans every preview manifest route in light and dark schemes and reports incomplete checks for human review. Install the matching Playwright Chromium browser as above before scanning. `ci:build` also runs this scan when its preview accessibility gate is enabled; the gate builds the preview and restores the customer production profile afterward.

An optional comma-separated route list can follow the URL. The default output directory is this dated evidence folder; use `QA_VISUAL_OUTPUT_DIR=/absolute/path/to/output` for exploratory runs to preserve the captured report and screenshots. The runner records which browser source it used.

Playwright stores downloaded browsers in its OS cache. To use a managed cache, set the official `PLAYWRIGHT_BROWSERS_PATH` variable for both installation and execution:

```sh
PLAYWRIGHT_BROWSERS_PATH=/absolute/path/to/browser-cache yarn playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=/absolute/path/to/browser-cache yarn qa:visual-acceptance http://127.0.0.1:4173/
```

To check an installed Chrome/Chromium binary instead, set `QA_CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chromium` for the visual runner. Playwright recommends its version-matched Chromium build; a custom executable may be incompatible with the pinned Playwright release. See the official [browser installation](https://playwright.dev/docs/browsers) and [Chromium launch options](https://playwright.dev/docs/api/class-browsertype#browser-type-launch) documentation.

Before asserting support for another engine/version, record a representative layout and interaction matrix against the actual release: direct routes/assets, light/dark/system, keyboard/focus, native dialogs, forms, storage denial, no-JS content and small-screen reflow. Record engine/version, OS, build profile/inputs, URL, viewport, input method and exact result. Browser/device availability may limit the matrix; list unrun checks explicitly.

The target is WCAG 2.2 AA with the separate 44×44 CSS px project target. Static markup and focused browser checks cover only part of that target. Real 200% text enlargement, screen-reader output, contrast/target measurements, long-copy/RTL behavior and the wider visual matrix remain separately tracked until corresponding evidence exists. Neither this policy nor the CSS target list is a conformance statement.
