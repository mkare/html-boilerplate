# Final CI with manifest-wide axe gate

**Date:** 2026-10-06  
**Working directory:** `/Users/solvia/Documents/cowork/html-boilerplate`  
**Command:** `PATH=/Users/solvia/.nvm/versions/node/v22.23.2/bin:$PATH BUILD_NOW=2026-10-03T12:00:00.000Z yarn ci:build`  
**Toolchain:** Node 22.23.2, Yarn Classic 1.22.22  
**Result:** exit 0, 184.53 seconds

This full run includes the newly wired `check:axe` CI step. The script built the catalog-preview profile, cleared `BUILD_DEMO`, started the local preview on loopback port 50666, scanned all 52 manifest routes in light and dark schemes, stopped the preview, then restored and verified the SaaS `customer-production` build.

| Acceptance | Result |
| --- | --- |
| Lint and check-only formatting; Markdown lint | Passed; 79 Markdown files, 0 issues |
| Responsive asset fixtures | Passed, 5/5 |
| Architecture and Bootstrap source checks | Passed, 144 source files and 96 Pug templates |
| Route inventory | Passed, 52 catalog-preview routes |
| Commerce tests | Passed, 13/13 |
| Production build and output contract | Passed, SaaS customer profile, 22 HTML / 38 files |
| Three-build reproducibility | Passed; SHA-256 `3caa8d96c5d9111bde45f5a1a182175450ac5da04a05708ee8968988b4eda454` |
| Release acceptance | Passed; extracted SaaS root/subpath and Agency root; zero budget failures |
| Deterministic SaaS archive | SHA-256 `958013dbb2158527198a62cdd1b2783ad48d68af789ee6d9b5874b54b8323c1b` |
| Axe preview scan | Passed; 104 route/scheme scans, 0 violations, 0 navigation/scan errors, 144 incomplete/manual-review items |
| SaaS production restoration | Passed; `check:dist` and profile check confirmed 22 HTML / 38 files at `/` |

The axe scan is automated evidence, not a WCAG conformance claim. Its incomplete findings still require human review. A separate CUA attempt to open an isolated browser for real 200% zoom could not proceed because both the in-app browser and isolated Chrome surface reported unavailable; zoom was left unverified, not counted as a pass. Manual screen-reader, strict dialog Tab wrap, real clipboard/password-manager behavior, genuine translated content/RTL, field performance, licensed raster-page integration, and clean historical baseline remain open as recorded in the implementation status ledger.

This file is a durable summary of the completed command output, not a verbatim terminal log. The preceding full-CI log without the newly integrated axe step remains separately preserved in `ci-build-accessibility-final-elevated.log`.
