# Final browser acceptance — 2026-10-06

## Run and source snapshot

- Local Istanbul time: 2026-10-06 02:14; report timestamp: `2026-10-05T23:14:21.093Z` UTC.
- Browser: Google Chrome **154.0.8037.98**, headless, launched through the installed Playwright package at `/Users/solvia/Documents/cowork/medium/articles/sveltekit-server-boundaries/example/node_modules/playwright/index.mjs` with a fresh ephemeral profile.
- Build: `catalog-preview`, `BUILD_NOW=2026-10-03T12:00:00.000Z`, root base/asset path `/`; isolated fixture `/var/folders/hj/1k3y6hf15lbd1bwt_1ff6g5h0000gn/T/framework-visual-verified-31lvcc`. The worktree `dist/` was not used by this browser run.
- Preview URL: `http://127.0.0.1:4176/`. The local preview server was stopped after the run.
- Preparation command from the repository root: `PATH=/Users/solvia/.nvm/versions/node/v22.23.2/bin:$PATH BUILD_NOW=2026-10-03T12:00:00.000Z node qa/framework-status-2026-10-06/prepare-browser-verified.cjs` — exit **0**.
- Browser command from the repository root: `PATH=/Users/solvia/.nvm/versions/node/v22.23.2/bin:$PATH node qa/framework-status-2026-10-06/browser-verified/visual-acceptance.mjs http://127.0.0.1:4176/` — exit **0**.
- Machine-readable observations and screenshot paths: [`visual-report.json`](./visual-report.json). Preview build output: [`preview-build.log`](./preview-build.log).

## Results

- Nine representative routes × **320/768/1440 CSS px** × **light/dark**: **54 observations**. Routes: SaaS and Agency home, SaaS sign-in, Commerce catalog/home/product detail, Markdown, Components, and Dashboard.
- No horizontal overflow; **0** measured text contrast failures; **0** visible controls below 24×24 CSS px or the separate 44×44 CSS px project target; **0** runtime errors, external requests, or non-GET requests.
- SaaS and Agency both followed system light/dark changes, preserved an explicit user choice, and retained it on reload.
- Six live HTML snippets (quick-start, layout, buttons, tabs, forms, content) were checked at each Components route visit: **36/36 exact markup/text-only assertions passed**. The CSS token sample remains a separate CSS example.
- Auth checks passed for the intentionally disabled static prototype, invalid/valid local demo form, password reveal/hide input type and accessible-label state, JavaScript disabled, page scripts blocked, and denied localStorage. Fallback cases sent no API or non-GET requests; denied-storage feedback correctly described in-memory/demo behavior.

## Limits

This is a bounded Chrome/DOM sample, not full-route/state coverage or a WCAG 2.2 AA claim. The environment has no connected screen reader; this headless session cannot set/verify actual 200% browser text zoom. Strict native-dialog Tab wrap, clipboard/password-manager integration, image/gradient contrast, real translated copy/RTL, and field LCP/INP/CLS remain unverified. No licensed/provenance-cleared raster demo image was supplied, so the page-level responsive raster check remains input-dependent.
