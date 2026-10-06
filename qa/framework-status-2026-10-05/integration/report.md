# Fresh framework integration verification

Recorded: 2026-10-05 12:43 UTC. This report records freshly executed evidence, separately from the prior implementation ledger.

- Toolchain: Node **22.23.2**, Yarn Classic **1.22.22**, Webpack **5.111.1**.
- Exact acceptance command: `PATH=/Users/solvia/.nvm/versions/node/v22.23.2/bin:$PATH BUILD_NOW=2026-10-03T12:00:00.000Z yarn ci:build`.
- First sandbox attempt stopped at `check:watch` because TCP binding to `127.0.0.1` returned `EPERM`. The seven preceding steps passed. Log: `ci-build.log`.
- The same complete command reran with approved escalation and **passed, exit 0, in 67.53 seconds**. Log: `ci-build-escalated.log`.
- **17/17 top-level acceptance/build steps passed**; commerce **12/12 tests passed**, zero failed/skipped. These include all five product-detail submit cases, so that behavior is no longer unverified at the unit-test level.
- Architecture: 121 source files. Manifest: 51 catalog pages, 39 generated wrappers. Profile contracts: 21 SaaS customer and 10 starter pages. Watcher: add, rename, invalid JSON retention, repair, removal, synchronized navigation. Override fixtures and malformed-input fallbacks passed.
- Production output at lock release: **customer-production / saas / basePath `/`; 21 HTML routes (20 package pages), 35 output files**. Three-build reproducibility: SHA-256 `8f2845dc81ac97af9f360ff29c4cf7a5f30490cfdfdbb1407c9d29edf7072851`. Root may subsequently replace this output for browser QA.
- Font check: 52,516 source WOFF2 bytes, local subsets/OFL/hashed assets passed. Static accessibility passed for all 21 customer pages. Phase 2 shell/controller checks passed.
- Release acceptance includes `test-preview-http.cjs`, `test-scaffolds.cjs`, `test-release-cli.cjs`, and `rehearse-upgrade.cjs`; extra standalone reruns would duplicate the full chain.
- Deterministic SaaS ZIP SHA-256: `99cf13a43049cf5391b390d2bfc56d49a227b0267c24a2934d7c369b01a2a71d`. Extracted SaaS root/subpath and Agency root static links/assets/checksums/licenses/CSP/metadata/budgets passed.

| Bundle | Routes in static bundle | HTTP-sampled HTML | CSS / JS / font HTTP requests | Aggregate HTML / CSS / JS / fonts / images gzip bytes | Budget failures |
| --- | ---: | ---: | --- | --- | ---: |
| SaaS root | 21 | 2 | 4 / 3 / 1 | 57,829 / 19,696 / 3,986 / 52,537 / 1,908 | 0 |
| SaaS `/preview/theme/` | 21 | 2 | 4 / 3 / 1 | 58,235 / 19,707 / 3,998 / 52,537 / 1,908 | 0 |
| Agency root | 9 | 2 | 4 / 0 / 1 | 19,997 / 13,144 / 0 / 52,537 / 2,901 | 0 |

The HTTP smoke serves the homepage and one nested route per bundle, then fetches homepage assets and verifies unknown route/asset 404 responses. It does **not** request every route over HTTP. The separate extracted static checker covers the full bundle inventory.

## Remaining acceptance and implementation limits

- Phase 0 clean baseline/tag and lockfile reconciliation remain deferred under inherited dirty-tree and no-stage/no-commit constraints. No retroactive baseline was fabricated.
- This full chain uses the existing installed dependencies. Release and override fixtures symlink `node_modules`; it does not prove a clean lockfile installation. A separate clean-install verification is being performed.
- Accessibility is static markup plus fake-DOM/controller coverage, not WCAG conformance. Broader light/dark, 200% text zoom, long text/RTL, contrast/target size, and assistive-technology acceptance are owned by the browser/manual lane.
- Real content remains English/ltr. Reciprocal hreflang and language-switch contracts pass fixtures; actual translated content and RTL acceptance remain untested. Field LCP/INP/CLS remain unmeasured.
- Plan §11 uses `yarn build:demo agency` as evidence, but `package.json` has no `build:demo` script at this snapshot. Equivalent demo selection is implemented via `--env demo=agency` or `BUILD_DEMO` and documented in `docs/architecture/phase-5/profiles-and-routes.md`.
- Plan §4.11 calls for fixed-version lint/format tooling. No formatter/linter scripts, corresponding configurations, or pinned direct dependencies exist in `package.json` at this snapshot. The custom architecture checker covers import boundaries.
- Plan Phase 6 asks for supported-browser policy. `.browserslistrc` currently defines CSS targets and explicitly states there is no JS transpilation/polyfill, but no separate supported/tested JS API browser statement was found in release/guide documents.
- §4.8.9 responsive raster formats/srcset/sizes and SVG sprite have no source implementation found. All current packaged images are SVG, so raster-format acceptance cannot be exercised with this inventory; do not invent a raster defect or claim those variants are implemented.
- The upgrade test replaces two synthetic framework versions in a temporary application, using the same production override loader before/after and verifying preserved user-file bytes. It does not demonstrate upgrading between two published real framework archives.

Build lock was released immediately after acceptance completed. No implementation, package, lockfile, ledger, or generated output was manually edited; this lane wrote only its integration evidence/log files.
