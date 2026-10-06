# Release performance budgets

The framework's initial budgets follow plan §7. They are release ceilings, not field-performance claims.

| Measure | Limit | Measurement |
| --- | ---: | --- |
| Standard page CSS | ≤ 60 KiB gzip per page | Sum of unique linked CSS assets, Node zlib gzip level 9. |
| Standard page JS | ≤ 70 KiB gzip per page | Sum of unique linked JS assets, Node zlib gzip level 9. |
| Dashboard/commerce page JS | ≤ 130 KiB gzip per page | Same measurement for dashboard/storefront route classes. |
| Font files | ≤ 120 KiB raw total | Emitted WOFF/WOFF2/TTF/OTF/EOT inventory. |
| Largest raster image | ≈ ≤ 180 KiB raw | Proxy for mobile first-view imagery; actual viewport usage must also be inspected. |
| Unreferenced JavaScript or CSS | 0 files | Every emitted JS and CSS asset must be referenced by a built HTML page. |
| Regression | ≤ +10% per existing page | Compare page CSS/JS gzip against the recorded demo baseline in `qa/release/baselines/`. |

`PERFORMANCE-MEASUREMENTS.md` and `.json` in a release include HTML/CSS/JS/font/image raw, gzip, and Brotli totals, largest files, per-page baseline deltas, and per-page CSS/JS sizes. Gzip is measured with Node zlib level 9; Brotli uses Node zlib quality 5. Brotli is reported for comparison but does not have a separate budget threshold. These are repeatable file measurements; actual transfer compression depends on the host. PNG, JPEG, WebP, and AVIF are already compressed, so their compression results are reported for inventory only. SVG is included in the vector image file total but excluded from the raster cap. Compression is measured separately from source minification.

The regression baseline is a checked-in page-level report for the same demo. New pages have no previous page-specific value; hard ceilings still apply. Shared CSS changes are visible in each page's aggregate. Do not silently replace a baseline to excuse a regression: review changed assets, explain the cost, then update baseline and documentation in a deliberate release change.

## Deliberate SaaS baseline refresh — 2026-10-05

The release implementation adds the shared marketing controller to the SaaS home and pricing pages. Its accessible monthly/yearly selector and demo-only newsletter feedback are a required part of those pages and emit a 1,038 B gzip chunk. The Session C baseline recorded 2,902 B for every page because it predated this page behavior; comparing the completed pages to that value rejected an expected feature cost. The previous measurement is preserved in `qa/release/baselines/saas-session-c.json`.

The new `qa/release/baselines/saas.json` comes from an extracted `release-html` SaaS archive built with `buildNow=2026-10-03T12:00:00.000Z` at `/`. It records 2,948 B JS gzip for the shared runtime and shell on pages without page-specific code, and 3,986 B on `saas.home` and `saas.pricing` with the marketing chunk. CSS values are remeasured from the same archive. This changes the comparison point only; the 70 KiB hard ceiling and +10% next-change regression policy are unchanged.

## Deliberate Agency baseline refresh — 2026-10-05

Agency previously excluded the shared shell runtime. Its initial system color scheme worked, but changes to the operating-system preference while the page was open were not handled. Loading the existing shared controller and adding the Agency theme button restores that required lifecycle and explicit-choice behavior. The Session C measurement had zero JavaScript; that comparison point cannot accommodate the completed behavior. The original is preserved in `qa/release/baselines/agency-session-c.json`.

A clean-installed isolated `release-html` Agency build at `/`, with `buildNow=2026-10-03T12:00:00.000Z`, measured all eight styled routes at **13,529 B CSS gzip** and **2,948 B JS gzip**. The runtime is 722 B and the shared base controller is 2,226 B. CSS increased from 12,766 B by 5.98% for the dark palette, contrast, theme control and shared focus/target corrections. The measured baseline in `agency.json` records this reviewed feature cost. The 60 KiB CSS / 70 KiB JS ceilings and +10% next-change regression rule are unchanged. The existing measurement helper excludes `system.404` from page comparisons.

Field targets of LCP ≤ 2.5 s, INP ≤ 200 ms, and CLS ≤ 0.1 (p75) are aspirations from the plan. This release harness does not measure field data and does not claim those targets are met. Visual layout, image placement, accessibility, and browser checks need separate human/browser evidence.
