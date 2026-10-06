# Agency baseline-free release measurement

Result: **PASS**, with no regression baseline supplied and no baseline edited. The measurement was made in the independently clean-installed fixture `/private/tmp/framework-clean-install-38yb73px` after a guarded current-source overlay.

Exact build command in that fixture:

```sh
PATH=/Users/solvia/.nvm/versions/node/v22.23.2/bin:$PATH BUILD_DEMO=agency SITE_URL=https://release.example.test BASE_PATH=/ BUILD_NOW=2026-10-03T12:00:00.000Z yarn build:release
```

Exact measurement command:

```sh
PATH=/Users/solvia/.nvm/versions/node/v22.23.2/bin:$PATH node qa/release/measure-budgets.cjs --root dist --manifest .generated/pages-manifest.json --write-json /Users/solvia/Documents/cowork/html-boilerplate/qa/framework-status-2026-10-05/integration/agency-release-measurements.json --write-markdown /Users/solvia/Documents/cowork/html-boilerplate/qa/framework-status-2026-10-05/integration/agency-release-measurements.md
```

Build: exit 0, 2.19 seconds. Measurement: exit 0, zero hard-budget/missing-asset/unused-JS failures. Output profile: `release-html`, demo `agency`, basePath `/`, 9 HTML routes. Gzip uses the existing helper's Node zlib level 9 file measurement.

| Page | Route | CSS gzip bytes | JS gzip bytes |
| --- | --- | ---: | ---: |
| agency.about | /about/ | 13,529 | 2,948 |
| agency.contact | /contact/ | 13,529 | 2,948 |
| agency.home | / | 13,529 | 2,948 |
| agency.not-found | /not-found/ | 13,529 | 2,948 |
| agency.project.northline | /projects/northline/ | 13,529 | 2,948 |
| agency.projects | /projects/ | 13,529 | 2,948 |
| agency.service.brand-strategy | /services/brand-strategy/ | 13,529 | 2,948 |
| agency.services | /services/ | 13,529 | 2,948 |

The existing helper deliberately excludes the minimal `system.404` from page CSS/JS metrics. Aggregate gzip bytes: HTML 20,910; CSS 13,529; JS 2,948; fonts 52,537; images 2,901. Linked JavaScript is `assets/js/pages/runtime.cc5d8fd1.js` and `assets/js/pages/base.b5444a9e.js`.

Old Agency baseline per styled page: CSS 12,766 bytes and JS 0 bytes. The measured CSS increase is **5.98%**; JavaScript adds **2,948 bytes** for the shared runtime needed by the Agency system-theme behavior. A percentage increase from zero is undefined. Root reviews this feature cost and owns any deliberate baseline archive/refresh; this lane has not substituted a baseline to pass acceptance.

## Overlay provenance and correction

The initial source snapshot filter incorrectly excluded every directory named `release`, which omitted nested `qa/release` and `docs/release`. Agency compilation succeeded, but the first measurement command failed with `MODULE_NOT_FOUND` for `qa/release/measure-budgets.cjs`. The filter was corrected to exclude only the top-level `release/` output directory; the source directories were copied and the measurement reran successfully. Original clean installation/build/check-dist evidence remains valid within its documented snapshot coverage.

Corrected guarded overlay: **306 filtered files**, SHA-256 `a02df333f0169e18bef612d480f7ee4883ccb12e705bd0d62cde006d523ab3d2`, recorded 2026-10-05T13:16:30Z. No source change occurred during either copy operation. `scripts/package-release.cjs` and `src/views/commerce/store.scss` changed between the first and corrected overlays; Agency source and emitted Agency sizes were unaffected. Existing clean-installed dependencies and `yarn.lock` remained unchanged.

Full final CI is held until root approves the baseline and browser corrections. Root's later source-packaging changes require one more guarded overlay before that run.
