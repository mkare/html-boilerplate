# Post-fix browser check

Date: 2026-10-05. Chrome **154.0.8037.98** ran against an isolated catalog-preview build with **51 routes** and fixed `BUILD_NOW=2026-10-05T12:00:00.000Z`. The build used the current sprite consumers and the current Sass pipeline. The saved [JSON report](./report.json) contains all **18 observations**; screenshots are in this directory.

The audit waits for theme color transitions to settle before measuring contrast. It also captures a temporary source copy and isolated browser profile. The source copy and profile were removed after capture.

## Measured results

| Brand and state | CSS viewport | Text below 4.5:1 | Controls below 24×24 | Controls below 44×44 | Horizontal overflow |
| --- | ---: | ---: | ---: | ---: | --- |
| SaaS, light and dark | 1440 | 0 | 0 | 0 | None |
| SaaS, dark | 640 and 320 | 0 | 0 | 0 | None |
| Commerce, light and dark | 1440 | 0 | 0 | 0 | None |
| Commerce, dark | 640 and 320 | 0 | 0 | 0 | None |
| Agency, light and system dark | 1440, 640 and 320 | 0 | 0 | 0 | None |
| Synthetic long RTL copy on all three brands | 320 | 0 | 0 | 0 | None |

The separate **160 CSS px / DPR 2 proxy** overflowed on SaaS and Commerce. Commerce had one control below the project's 44×44 px target at that proxy width; no control fell below 24×24 px. Agency did not overflow at that proxy. The browser UI's page-zoom control was not used, so this is not 200% zoom acceptance.

The screenshot [default-light-1440.png](./default-light-1440.png) shows the external SVG sprite icons rendering in the SaaS feature cards. The sample produced no runtime errors or external requests. An unknown static route returned 404. The clipped-text heuristic reports some deliberately clipped, visually hidden, or decorative elements; those candidates need human interpretation and are not automatic content-loss findings.

## Limits and open checks

- This is a bounded sample of SaaS, Commerce and Agency home routes, not a complete route/state visual matrix.
- The 640 px viewport is a responsive layout check corresponding to a 1280 px desktop at a narrower CSS width. Neither it nor the 160 px proxy is actual browser zoom.
- RTL used synthetic Arabic labels and direction on existing English pages. It checks layout resilience, not translations, locale switching, or `hreflang`.
- This DOM sample does not establish WCAG 2.2 AA conformance. Real 200% browser enlargement, screen-reader review, strict dialog focus wrap, broader interactive states, and translated instances remain open.
