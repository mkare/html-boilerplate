# Browser acceptance evidence — 2026-10-05

## Latest post-remediation matrix

- **Run:** `PATH=/Users/solvia/.nvm/versions/node/v22.23.2/bin:$PATH node qa/framework-status-2026-10-05/browser/visual-acceptance.mjs http://127.0.0.1:4174/`; Chrome **154.0.8037.98**, fresh ephemeral Playwright profile, isolated `catalog-preview` source snapshot, `BUILD_NOW=2026-10-03T12:00:00.000Z`.
- **Snapshot:** `/var/folders/hj/1k3y6hf15lbd1bwt_1ff6g5h0000gn/T/framework-visual-preview-kWUSUC`; created by `node qa/framework-status-2026-10-05/prepare-preview.cjs` from the worktree after the component catalog parity assertion was added.
- **Coverage:** nine representative routes (`/demos/saas/`, `/demos/agency/`, `/demos/saas/sign-in/`, `/commerce/catalog/`, `/markdown/`, `/components/`, `/dashboard/`, `/commerce/`, `/commerce/products/arc-glass-set/`) × widths **320/768/1440 CSS px** × **light/dark**, total **54 observations**.
- **Result:** zero horizontal overflows; zero measured text contrast failures; zero visible interactive targets below **24×24 CSS px**; zero controls below the separate **44×44 CSS px project target**; zero runtime errors, external requests, or non-GET requests. Both brand demos passed system light↔dark changes and explicit-choice persistence checks. The six `/components/` viewport/scheme visits verified that the displayed button snippet exactly matches the live Pug-rendered button markup and remains text-only.
- **Remediated from the immediately preceding 54-state run:** disabled Commerce pagination contrast was 2.34:1 in light mode; Components breadcrumbs/links/disclosure summaries, dashboard search/navigation/brand, and the auth footer link missed target-size thresholds. The owning source styles now pass this same matrix.
- **Evidence:** [`visual-report.json`](./visual-report.json) stores every route/width/scheme observation; route screenshots are beside it. The previously recorded 18-state transition-aware run and 42-state baseline remain historical at `post-fix-transition-aware/` and `baseline-matrix-report.json`.
- **Limits:** this bounded matrix does not establish WCAG 2.2 AA conformance or cover every route/state. It does not exercise genuine 200% browser text zoom, a screen reader, strict APG dialog Tab wrap, real password-manager or clipboard behavior, all image/gradient/state contrast, authentic translated content, or field LCP/INP/CLS. Synthetic RTL is structural only.

## Environment and evidence boundaries

- Google Chrome **154.0.8037.98**, headless, launched through an already installed Playwright package with an approved narrowly scoped command.
- Fresh temporary browser profile and isolated contexts; the user's open Chrome profile and tabs were not used.
- Initial CUA discovery returned `browsers: []`; creating fresh IAB and Chrome tabs each returned `Browser is not available`. Headless tooling was therefore used.
- URL: `http://127.0.0.1:4173/`; root-owned frozen source snapshot at `/var/folders/hj/1k3y6hf15lbd1bwt_1ff6g5h0000gn/T/framework-visual-preview-uQbyJG`; `catalog-preview`, fixed `BUILD_NOW=2026-10-03T12:00:00.000Z`.
- A first attempt hit an unrelated root-build HTTP 404 and produced no browser acceptance evidence. The server was replaced by the isolated fixture before the successful matrix.
- `baseline-matrix-report.json` and `baseline-screenshots/` preserve the pre-fix matrix; `baseline-light-report.json` preserves an interrupted initial light-only run. `visual-report.json` and the top-level PNGs are the most recent run. The harness lives in `visual-acceptance.mjs`.
- These are focused browser measurements and screenshots. They do not establish WCAG 2.2 AA conformance.

## Completed baseline observations

| Check | Viewport / scheme / input | Observed result | Evidence |
| --- | --- | --- | --- |
| Representative layouts | `/demos/saas/`, `/demos/agency/`, `/demos/saas/sign-in/`, `/commerce/catalog/`, `/markdown/`, `/components/`, `/dashboard/`; 320/768/1440 × light/dark; 900px viewport height | 42 observations, zero document horizontal overflow, zero page exceptions | `baseline-matrix-report.json` → `viewport` |
| Both brand screenshots | SaaS and Agency; 320/768/1440 × light/dark | Twelve full-page and twelve viewport captures. Agency's first scoped dark palette renders genuinely dark surfaces, rather than merely changing the root attribute. Baseline light Agency card/stat contrast defects remained. | `demos-{saas,agency}-{light,dark}-{320,768,1440}-{full,top}.png` |
| Skip link | SaaS; 320/1440 × light/dark; Tab / Enter | Visible at x12/y12 after two animation frames; Enter focuses `main#siteMain` | `keyboard[].skip`, `skipTarget` |
| Mobile menu | SaaS; 320 × light/dark; Space / Tab / Shift+Tab / Escape | Menu opens, first nav link is reachable, reverse traversal returns to toggle, Escape closes and returns focus | `keyboard[].menu*` |
| Dialog | Components; 320/1440 × light/dark; Enter / Tab / Shift+Tab / Escape | Input receives initial focus; Escape closes and focus returns to `#open-dialog`. After the last control, a Tab briefly yields `document.activeElement=body`, then the next Tab returns to the input; no underlying page control was reached. Strict APG wrap is unverified. | `keyboard[].dialog*` |
| SaaS auth prototype | `/demos/saas/sign-in/`; both schemes | Intentionally disabled static fieldset, consistent with page metadata. `autocomplete=current-password` is present. This is not the enhanced validation pilot. | `form` |
| Enhanced auth | `/auth/login/`; both schemes; real field filling / submit | Fields are enabled and editable; email/current-password hints are present. Invalid user submission focuses email and exposes `aria-invalid`; native validation blocks submission before the controller's live feedback changes. | `form` |
| Fonts and requests | Entire baseline matrix | Only the local hashed Latin Inter WOFF2 was requested on the seven English routes; zero external requests and zero page errors | `viewport[].localFonts`, `requests`, `errors` |

Reduced motion was requested for the QA contexts. The first light-only skip-link reading happened during its focus animation and incorrectly captured negative y; the complete matrix waits two frames and corrects that harness artifact.

## Actionable baseline defects sent to root

All values below are computed CSS text colors with solid or alpha-composited backgrounds. Gradients, images and opacity are excluded from definite contrast claims. Ratios use 4.5:1 for normal text and 3:1 for qualifying large text; raw repeated samples are not unique defect counts.

| Owning source | Reproduction / measurement |
| --- | --- |
| `src/pages/agency/agency.scss` | Light `.agency-band` project cards inherit inverse text on an almost-white card: 1:1. Unbanded stats use near-white text on paper: 1.080:1 for the numbers and 1.060:1 for labels. Footer brand subtitle is 2.133:1. |
| `src/views/marketing/marketing.scss` | Light featured-card and testimonial metadata muted gray on lilac: 4.256:1. Dark standalone text links/kickers remain dark violet: 2.839:1 on the page, 2.337:1 on panel. Dark partner logos: 3.088:1. |
| `src/views/commerce/store.scss` | Local page palette stays light under both root schemes. Muted hero/filter/result text and inactive chips: 4.344:1. Disabled pagination text was not treated as a required contrast defect. |
| `src/views/markdown/style.scss` | Light sidebar and TOC muted text: 4.256:1; pale notice text: 4.151:1. |
| `src/views/components/components.scss` | Light primary-button white text on violet: 4.467:1; light muted metadata: 4.289–4.484:1. Dark primary-button text is white on pale lavender: 1.994:1. |
| `src/ui/atoms/button/button.scss` / `src/scss/theme.scss` | Dark shared secondary teal text on light fallback background: 1.289:1; danger white text on pink: 1.814:1. |
| `src/views/dashboard/dashboard.scss` | Light quick-action copy: 2.839:1; table headers: 2.340:1; activity times/project subtitles: 2.564:1. |

Target measurements were separately reported against the **project's 44×44 CSS-pixel design goal** and the **WCAG 2.2 AA 24×24 minimum with applicable exceptions**. Many standalone text links and compact inputs measured under 24px high, including SaaS text links (20.64px), commerce detail links (16.31px), quick-view title buttons (15.75px), choice-label effective hit areas (19.92px), and dashboard filter (18.8px). Spacing and inline exceptions were not fully reviewed, so these are project target gaps and candidates for AA review, not an automatic page-level AA failure. Agency had no under-24 sampled targets.

## Acceptance still requiring genuine manual mechanisms

- Actual 200% browser text enlargement: unavailable in this Chrome headless session; viewport emulation, page scale and CSS zoom were not substituted. No installed Firefox runtime was available.
- Screen-reader output for navigation, labels, validation, modal state and storage/status announcements: no screen reader is connected. DOM/AX evidence is supporting evidence only.
- Real password-manager autofill and native clipboard paste: hints/editability were inspected; actual integrations were not exercised.
- Full non-text/state contrast, image/gradient text contrast, and all target-size exceptions: broader manual measurements remain.
- Long translated copy, authentic translated navigation and RTL: no localized page instances exist. No translations were fabricated.
- Field LCP/INP/CLS: not measured by this browser lane.

The latest post-fix matrix is the section at the beginning of this report. It is automated evidence with the manual limits listed above; it does not replace genuine assistive-technology or text-zoom review.
