# Phase 5 — Demo profiles and mounted routes

## Demo selection

`BUILD_DEMO` selects the customer package (`saas` by default; `agency` is also supported). `BUILD_PROFILE` selects the build profile. The Webpack CLI form `--env demo=agency` is accepted by the existing config entry point. A demo package is represented by page records that share `demoId`; its root page declares `demoHome: true`. Starter eligibility is explicit through `starter: true`. Shared records can use `requiredByDemos` to opt into named packages.

## Profile behavior

| Profile | Included pages | Demo routes | Indexing |
| --- | --- | --- | --- |
| `development` | Framework pages and all declared demos | Demo records mount below `/demos/<demoId>/` | `noindex,nofollow` |
| `catalog-preview` | Framework pages and all declared demos | Demo records mount below `/demos/<demoId>/` | `noindex,follow`; robots remains readable and no sitemap is emitted |
| `customer-production` | Selected demo, explicit shared dependencies, and `404.html` | Selected `demoHome` becomes `/`; other routes keep their package-relative path | Per-page robots policy, production sitemap when `SITE_URL` is configured |
| `starter` | Selected demo’s starter-marked pages, explicit dependencies, and `404.html` | Selected `demoHome` becomes `/` | Every page is `noindex,nofollow` |
| `release-html` | Selected demo, explicit shared dependencies, and `404.html` | Selected `demoHome` becomes `/` | Per-page robots policy, production sitemap when `SITE_URL` is configured |

The demo mount and locale prefix are applied before output generation, route-helper construction, navigation generation, canonical URLs, and sitemap URLs. `BASE_PATH` is then applied by the route helper. For example, with `BASE_PATH=/preview/theme/`, the default-language SaaS preview begins `/preview/theme/demos/saas/`, while a Turkish SaaS page is `/preview/theme/demos/saas/tr/<page>/`. A customer SaaS build keeps English at `/preview/theme/<page>/` and puts translated Turkish pages at `/preview/theme/tr/<page>/`.

## Locale routes and language switching

`config/site.config.cjs` provides a `defaultLocale` for the selected package and a `defaultLocales` map for demos included in catalog preview. SaaS and Agency currently default to `en`; `DEFAULT_LOCALE` can select a different default for the packaged site. Page records retain the actual content `locale` and `direction`. Only non-default locale instances receive `/<locale>/`; legacy records under `src/views/**` retain their existing routes during migration.

`translationKey` groups only actual page instances. Every declared `translationLocales` target must be present in the selected profile. The build then generates reciprocal `hreflang` links and passes the same existing targets to the shared site and Agency language switchers. The switcher is absent when no counterpart exists. Current SaaS and Agency copy remains English-only; locale route and switcher behavior is covered with synthetic QA fixtures, not invented page translations.

## Current SaaS page instances

Customer SaaS includes the home, features, pricing, FAQ, three account-link pages, two illustrative legal pages, the blog archive and its generated pagination/category/article pages, plus the system 404. Starter SaaS keeps only records explicitly marked `starter`; blog pages are omitted. All current SaaS content is English (`en`, `ltr`). Translation keys identify page families, but there are no translated page instances; no `hreflang` alternate is emitted. When a record declares `translationLocales`, the selected profile must contain one page for every declared locale before reciprocal alternates are generated.

## Manifest-derived shell navigation

Each page can declare `navigation.groups`, `navigation.label`, and `navigation.order`. Webpack builds `mainNavigation`, `footerNavigation`, and `blueprintNavigation` from the already-filtered page list. Customer navigation therefore cannot point to another demo’s manifest route. Internal links in page templates use `route(pageId)`; assets use `assetUrl()` or Pug asset imports.

## Build-time contracts

- A customer profile needs exactly one selected `demoHome`, and its declared route must be `/`.
- Page IDs are unique after Unicode NFC normalization and case folding.
- Output collisions are checked after profile mount and path normalization.
- Translation locale targets missing from the selected profile fail the build.
- Default-locale routes stay unprefixed; non-default demo routes receive one locale segment after the demo mount (preview) or at the package root (customer build).
- `BASE_PATH`, locale, and demo mount are composed once by `route()`; canonical, hreflang, navigation, and output paths use the materialized route.
- Language switching is limited to existing `translationKey` counterparts; no target is synthesized from a locale tag alone.
- Account forms are disabled demonstrations. Newsletter feedback is local-only; no form sends or stores data.
- Indexable routes with `SITE_URL` use absolute canonical URLs that include both `BASE_PATH` and the selected profile route.
