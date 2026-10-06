# Browser and axe acceptance after accessibility remediation

Run date: 2026-10-06 (UTC). The worktree was inherited dirty; these results describe the current implementation snapshot and are not a historical clean-baseline comparison.

## Preview build and profile checks

- Node 22.23.2, Yarn Classic 1.22.22, Webpack 5.111.1.
- `BUILD_NOW=2026-10-03T12:00:00.000Z yarn build:preview` — exit 0.
- `EXPECTED_PROFILE=catalog-preview yarn check:profile` — exit 0; 52 routes, 20 selected SaaS pages.
- `yarn check:dist` — exit 0; 52 HTML files, 95 output files at `/`.
- Local static preview: `http://127.0.0.1:4173/`.

## Visual, interaction, and source parity sample

Command: `QA_VISUAL_OUTPUT_DIR=/private/tmp/framework-visual-latest yarn qa:visual-acceptance http://127.0.0.1:4173/` — exit 0. Playwright 1.63.0 managed Chromium 153.0.8010.12, temporary browser context, nine representative routes × 320/768/1440 CSS px × light/dark = 54 observations.

- No horizontal overflow, measured text contrast failures, targets below 24×24 or below the project’s 44×44 target, JavaScript errors, external requests, or non-GET requests in this sample.
- System theme transitions and explicit-choice persistence passed for both SaaS and Agency. Auth was checked with JavaScript disabled, page scripts failed, and storage denied; no authentication request was made. Password reveal/hide behavior passed.
- Six component catalog source examples matched live rendered markup as text across six route visits (36 assertions).
- Machine report and screenshots are in this directory. The report’s screenshot references are relative to the repository root.

## Axe scan

Command: `yarn qa:axe http://127.0.0.1:4173/` — exit 0. It scanned all 52 catalog-preview manifest routes in light and dark schemes: 104 route/scheme scans, **0 violations**, 0 navigation or scan errors, and 144 incomplete/manual-review results. Full output is in [axe-report.log](./axe-report.log).

The incomplete results include context-dependent contrast and ARIA checks which axe cannot decide automatically. Review those alongside screen-reader, zoom, image/gradient, and state checks; this scan is not a WCAG 2.2 AA conformance claim.

## Still requiring human or external input

- Real 200% browser text enlargement and screen-reader output.
- Strict native-dialog Tab/Shift+Tab wrap, real password-manager and clipboard behavior.
- Context-dependent non-text, image/gradient, focus, and state contrast review.
- Genuine translated long copy and RTL page instances.
- Field LCP/INP/CLS data and a provenance-cleared raster demo image.
