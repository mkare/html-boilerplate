# Final integration and release acceptance — 2026-10-06

- Worktree: `/Users/solvia/Documents/cowork/html-boilerplate`.
- Toolchain: Node **22.23.2**, Yarn Classic **1.22.22**, Webpack **5.111.1**.
- Exact command: `PATH=/Users/solvia/.nvm/versions/node/v22.23.2/bin:$PATH BUILD_NOW=2026-10-03T12:00:00.000Z yarn ci:build 2>&1 | tee qa/framework-status-2026-10-06/integration/ci-build-final-verified.log`.
- Exit **0**, **88.86 seconds**. Complete output: [`ci-build-final-verified.log`](./ci-build-final-verified.log).

The full chain passed source lint and formatting (Markdown: **70 files**, zero issues), source-quality fixtures, responsive asset fixtures **5/5**, architecture boundaries (**136** source files), Bootstrap allowlist (**89** Pug templates), shared UI primitives, 51-route/profile/locale/block contracts, two-entry runtime sharing, cross-page asset-reuse budget fixtures, commerce tests **12/12**, watcher and project override acceptance, auth shell/password-toggle checks, and all six component catalog source-pair contracts.

The production build emitted **21 HTML / 36 output files**. Static accessibility markup checks passed on all 21 pages. Three-build reproducibility SHA-256: `f2f1788aa7094edd18c83c5fa4a60cad0372257475fa78ab573ec899d1f5bcdf`.

Release acceptance passed scaffold and upgrade rehearsals; extracted SaaS root, SaaS `/preview/theme/` subpath, and Agency root bundles passed link, asset, checksum, license, CSP, metadata, and budget checks. Deterministic SaaS archive SHA-256: `26a3f6e9a76575d97c1937b42a13c0be9646175856f24eb2acf8639b1891b802`. All three release profiles reported zero budget failures. These are build/output measurements, not field performance.
