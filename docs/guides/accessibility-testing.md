# Accessibility testing

## Automated axe acceptance

`yarn check:axe` runs the repeatable browser acceptance used at the end of `yarn ci:build`. It builds `catalog-preview`, chooses a free loopback port, serves the built files, and runs the pinned axe scanner over every route in `.generated/pages-manifest.json` in light and dark color schemes. The current catalog contains 52 routes, so each run performs 104 route/scheme scans.

The wrapper always stops its preview server and then rebuilds the standard SaaS `customer-production` output using `BUILD_NOW` from the caller, or `2026-10-03T12:00:00.000Z` when it is unset. It verifies the restored output with `check:dist` and the SaaS customer profile contract. A failed preview build, server startup, scan, or restore returns a nonzero status; the restore is attempted even when the preview build or axe scan fails.

Use Node 22.23.2 and Yarn Classic 1.22.22. Install project dependencies and the Chromium revision pinned by the project's Playwright dependency before running CI:

```sh
yarn install --frozen-lockfile
yarn playwright install chromium
yarn ci:build
```

CI images must run `yarn playwright install chromium` after installing the project dependencies and before `yarn ci:build`. This installs the browser revision expected by the locked Playwright version. Linux images also need Playwright's Chromium system libraries; on Debian/Ubuntu runners, install them with `yarn playwright install --with-deps chromium` (or provision the equivalent packages in the image), then run `yarn ci:build`.

## Manual preview scan

For local debugging without the wrapper, build and serve the preview in separate terminals:

```sh
yarn build:preview
yarn preview
```

Then run the scanner from the project root:

```sh
yarn qa:axe http://127.0.0.1:4173/
```

The server URL path must exactly match `site.basePath` in `.generated/pages-manifest.json`. For a subpath preview, use the same `BASE_PATH` for both build and server, for example:

```sh
BASE_PATH=/preview/theme/ yarn build:preview
BASE_PATH=/preview/theme/ yarn preview
yarn qa:axe http://127.0.0.1:4173/preview/theme/
```

The scanner launches Playwright's Chromium by default. If a compatible local executable is already installed, it can be selected with `QA_CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chromium`; Playwright recommends using its version-matched browser. The scanner fails on route navigation errors, unexpected HTTP status, axe scan errors, or reported violations. Axe `incomplete` results are printed for human review and do not alone fail the run. The current full scan reports 144 incomplete items for manual review; that count can change with page content and axe updates.

## Coverage and limits

The pinned axe-core 4.13.0 run includes the available `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, and `wcag22aa` tags. This axe release does not expose a separate `wcag22a` tag. See the [axe-core API tag reference](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md) and [axe-core releases](https://github.com/dequelabs/axe-core/releases).

An automated axe pass does not establish WCAG conformance. It cannot reliably judge every context-dependent contrast case, content meaning, or interaction sequence, and its incomplete results need human review. Continue keyboard and focus checks, screen-reader and other assistive-technology testing, real browser zoom/reflow checks, translated and right-to-left content review, and inspection of image, gradient, and state-dependent visuals.
