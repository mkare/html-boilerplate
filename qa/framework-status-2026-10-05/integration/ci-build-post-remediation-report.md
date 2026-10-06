# Post-remediation integration and release acceptance

Recorded: 2026-10-06 (Europe/Istanbul; 2026-10-05 UTC). This final report corresponds to the worktree after the browser, component documentation, HTTP redirect, scaffold build, customer font, and source-quality changes recorded in the status ledger.

- Worktree: `/Users/solvia/Documents/cowork/html-boilerplate`.
- Toolchain: Node **22.23.2**, Yarn Classic **1.22.22**, Webpack **5.111.1**.
- Fixed build input: `BUILD_NOW=2026-10-03T12:00:00.000Z`.
- Exact command: `PATH=/Users/solvia/.nvm/versions/node/v22.23.2/bin:$PATH BUILD_NOW=2026-10-03T12:00:00.000Z yarn ci:build`.
- Result: **exit 0 in 90.76 seconds**. Complete unabridged output: [`ci-build-final.log`](./ci-build-final.log).

## Acceptance covered

- `yarn lint`, `yarn format:check`, and disposable source-quality fixtures passed. Markdown lint covered **61 files**, including source component guides. Prettier remained check-only.
- Responsive image asset fixtures passed **5/5**. Architecture boundaries checked **122 source files**; route inventory found **51 catalog routes**; manifest, collection, locale, profile, Autoprefixer, and commerce checks passed. Commerce passed **12/12**.
- Watcher add/rename/invalid-input retention/repair/remove and project override integration passed, including malformed-input fallback.
- Production SaaS build and `check:dist` passed for base path `/`: **21 HTML / 36 output files**. Three-build repeatability SHA-256: `f2f1788aa7094edd18c83c5fa4a60cad0372257475fa78ab573ec899d1f5bcdf`.
- Font checks passed for local WOFF2 subsets, OFL, and hashed outputs. Static accessibility checks passed on 21 pages; Phase 2 shell checks passed.
- Release acceptance passed for `/about?source=acceptance` → **308** with canonical slash and preserved query, then `/about/` → **200**, at root and `/preview/theme/`; unknown deep routes returned the 404 document without an SPA fallback.
- Scaffold acceptance copied actual build inputs into a temporary fixture, ran the page/component/demo CLIs and a production-mode catalog-preview Webpack build, and verified the generated `/help/` page and generated component markup in output. Invalid generated-component props and shared button variants remained actionable failures.
- CLI and representative override upgrade rehearsal passed. The Inter WOFF2, OFL license, and customer overrides remained byte-identical across the synthetic framework-version transition. A separate isolated production override build verified the custom font reference resolves to an existing content-hashed asset with matching font bytes.
- Deterministic SaaS release ZIP SHA-256: `32dfb789beb8d3e9499761e44893ad1c9de37ba434aefaee9edbe3d9cf1f32da`. Extracted SaaS root/subpath and Agency checks passed link, asset, checksum, license, CSP, metadata, and budget checks.

| Bundle | Routes | Aggregate HTML / CSS / JS / fonts / images gzip bytes | Budget failures |
| --- | ---: | --- | ---: |
| SaaS root `/` | 21 | 57,407 / 19,892 / 3,986 / 52,537 / 3,048 | 0 |
| SaaS subpath `/preview/theme/` | 21 | 57,830 / 19,903 / 3,998 / 52,537 / 3,048 | 0 |
| Agency root `/` | 9 | 20,962 / 13,549 / 2,948 / 52,537 / 2,901 | 0 |

The HTTP smoke requests the homepage and one nested route per extracted bundle, plus homepage assets; the static checker covers the full bundle inventory. The package currently contains SVG images only, so no raster page-level budget or browser `currentSrc` acceptance is implied. Browser geometry/contrast and the six component-snippet parity observations are in the separate [`browser/report.md`](../browser/report.md) and [`visual-report.json`](../browser/visual-report.json).

## Remaining acceptance

- The matrix is targeted automated evidence, not WCAG 2.2 AA conformance. Genuine screen-reader output, real 200% text enlargement, strict native-dialog Tab wrap, native password-manager/clipboard behavior, and broader non-text/state contrast review remain open.
- Real translated content/RTL instances and field LCP/INP/CLS data are unavailable.
- A raster image with known provenance and license is required for the remaining responsive-raster page integration; the legacy `cadillac.jpg` is not approved for use.
- The inherited worktree was already dirty, so this run does not create a historical clean baseline or Git tag.
