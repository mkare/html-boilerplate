# ADR-006 — Milestone names and v1 scope

- **Status:** Accepted
- **Decision date:** 2026-10-04
- **Decision:** Phase 0–3 is the architecture pilot and ends with the auth family. Agency/corporate is the first complete demo. SaaS is the second complete demo for v1. Commerce remains a storefront pilot; it does not count as a completed second demo in this release.

## Context and evidence

“Pilot,” “demo,” and “v1” must not describe the same delivery when a folder or landing page can look complete without a full customer route set. The plan defines Phase 0–3 as architecture validation, Agency as the first coherent site, and Phase 5 as the decision point for a second demo. A blueprint is a reusable page definition; a page instance is one built route with its locale/content; a content record is an article, product, or similar item.

The SaaS surface is supported by existing marketing, pricing, FAQ, product-preview, auth, and blog/article building blocks. Phase 5 now adds distinct SaaS home, features, pricing, FAQ, article archive, article detail, and account-link routes. Forms remain static demonstrations; no authentication, newsletter delivery, billing, or backend behavior is implied. The existing Commerce storefront remains a useful pilot but does not yet provide the complete shop, category, product, cart, checkout UI, and order-status package expected for a full store demo.

## Decision

Select **SaaS** as the second complete demo for v1. Keep the current commerce and dashboard surfaces as preserved examples until a later scope decision. A third complete demo remains capacity-dependent.

## Consequences

- v1 targets two complete demos: Agency and SaaS.
- Customer builds mount only the selected demo at `/`; catalog preview mounts examples below `/demos/<demo>/`.
- Starter builds use the selected demo’s starter-marked page instances and a noindex policy.
- SaaS includes home, features, pricing, FAQ, blog archive/article routes, and static sign-in, account-creation, and password-reset links.
- The static framework does not provide production authentication, payment, email delivery, CMS, visual page builder, or micro-frontend runtime.
- Page-instance count, blueprint count, layout count, content-record count, and theme variants remain separate measures.

## Traces

Plan §3/K6, §4.9, §5 Phases 3–5; review report R14; `docs/architecture/phase-5/profiles-and-routes.md`.
