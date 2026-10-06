# Release performance measurements

- Profile: `release-html`
- Demo: `agency`
- Base path: `/`
- Build site URL: `https://release.example.test`
- Build input timestamp: `2026-10-03T12:00:00.000Z` (fixed with --build-now for reproducibility)

Files are measured from the emitted build. Gzip uses Node zlib level 9 to compare files consistently; transfer compression is host-dependent. Image gzip is reported for inventory only because PNG/JPEG/WebP/AVIF are already compressed. The largest raster image is a proxy for the mobile-hero-image budget; inspect actual viewport use separately. No field LCP/INP/CLS claim is made.

## File inventory

| Type | Files | Raw bytes | Gzip bytes | Largest (raw / gzip bytes) |
| --- | ---: | ---: | ---: | --- |
| HTML | 9 | 67142 | 20910 | index.html (11867 / 3201) |
| CSS | 4 | 60413 | 13529 | assets/css/pages/core.fa2827fa.css (25845 / 5878) |
| JS | 2 | 6985 | 2948 | assets/js/pages/base.b5444a9e.js (5665 / 2226) |
| FONT | 2 | 52516 | 52537 | assets/fonts/Inter-Latin.4f2981d8.woff2 (48256 / 48254) |
| IMAGE | 4 | 6488 | 2901 | assets/images/favicon.b7d0edc6.svg (2282 / 954) |

## Per-page CSS/JS budgets

| Page | CSS gzip bytes | JS gzip bytes | Budget class |
| --- | ---: | ---: | --- |
| `agency.about` | 13529 | 2948 | standard |
| `agency.contact` | 13529 | 2948 | standard |
| `agency.home` | 13529 | 2948 | standard |
| `agency.not-found` | 13529 | 2948 | standard |
| `agency.project.northline` | 13529 | 2948 | standard |
| `agency.projects` | 13529 | 2948 | standard |
| `agency.service.brand-strategy` | 13529 | 2948 | standard |
| `agency.services` | 13529 | 2948 | standard |

## Limits

- Standard page CSS: ≤ 61440 B gzip per page.
- Standard page JS: ≤ 71680 B gzip per page.
- Dashboard/commerce page JS: ≤ 133120 B gzip per page.
- Total font files: ≤ 122880 B raw.
- Largest raster image: ≤ 184320 B raw (approximate first-view proxy).
- Regression: no more than +10% from a recorded page-level gzip baseline.
- Unrelated JS assets: zero emitted but unreferenced.

These caps align with plan §7. Historical initial-build values in the plan are separate baselines and are not substituted for this release's measurements.
