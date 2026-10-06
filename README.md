# Multipurpose HTML theme framework

A static multi-page framework with Agency and SaaS demos, shared UI, layouts and a Webpack/Pug/SCSS asset pipeline.

## Introduction

Page records and collections generate real HTML routes. Agency and SaaS reuse shared core/layout/component modules; the legacy bridge preserves the original view routes. Auth, newsletter and commerce examples are demonstrations. Production account, payment and delivery services require adapters or a backend.

## Features

- Multipage website support
- Webpack for bundling assets
- SCSS for stylesheets
- Development server with live reload
- HTML template generation using [PugPlugin](https://github.com/webdiscus/pug-plugin)
- Asset management for images
- Shared UI catalog with semantic HTML and keyboard/lifecycle examples
- Design tokens, responsive layout primitives and dark mode
- Native dialog, tabs, form validation, toast and countdown interactions

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)

## Getting Started

### Prerequisites

Before you begin, ensure you have met the following requirements:

- Node.js `22.23.2` (the supported range is `>=22.23.2 <23`) and Yarn Classic `1.22.22` are required. You can install Node.js from [nodejs.org](https://nodejs.org/).

## Installation

```sh
nvm use
yarn install --frozen-lockfile
```

## Usage

```sh
yarn start                          # Development catalog, live reload
yarn build                          # SaaS customer production at /
yarn build:demo agency              # Agency customer production at /
yarn build:demo saas --profile starter
yarn build:preview                  # Both demos and framework examples
```

`build:demo agency|saas` accepts `--profile development|catalog-preview|customer-production|starter|release-html`. Without that option it uses `BUILD_PROFILE` when set, otherwise `customer-production`. Customer production mounts the selected demo at `/` and filters package routes/navigation. Starter includes only starter-marked pages with `noindex,nofollow`. Catalog preview mounts demos under `/demos/<demo>/`, includes the framework examples and emits `noindex,follow`; it is not an access-control boundary.

```sh
SITE_URL=https://www.example.com BASE_PATH=/preview/theme/ BUILD_NOW=2026-10-03T12:00:00.000Z yarn build:demo agency
BASE_PATH=/preview/theme/ yarn preview
```

For a root build use `yarn preview`: static preview serves `dist/` at `http://localhost:4173/` without an SPA fallback (`PORT` changes the port). Keep preview `BASE_PATH` equal to the build mount. Existing extensionless routes redirect to their canonical trailing slash; unknown routes return `404.html`. `SITE_URL` is an origin without a path, while `BASE_PATH` supplies the directory. Rebuild before relocating root-built HTML under a subpath. Development uses the URL printed by `yarn start`.

## Framework contracts and verification

Yarn Classic `1.22.22` and Node.js `22.23.2` are the supported toolchain. `yarn.lock` is the authoritative dependency lockfile; `package-lock.json` remains in the inherited tree until its separately tracked removal. Use Yarn for installs and scripts.

```sh
yarn check:dist                    # After the relevant build
yarn check:accessibility           # Static markup checks
BUILD_NOW=2026-10-03T12:00:00.000Z yarn ci:build
```

The CI chain checks pinned source lint/format rules, architecture, manifest/collections, assets, watcher, overrides, UI/runtime, commerce, profiles, repeatability and extracted releases. Coordinate shared build/watch outputs before running checks concurrently. The architecture import checker remains a separate layer-boundary check.

```sh
yarn package:release --demo saas --site-url https://www.example.com --base-path / --build-now 2026-10-03T12:00:00.000Z --out /tmp/saas-release.zip
```

The packager builds in an isolated copy and delivers `html/`, `source/`, `starter/`, documentation, licenses and a checksum manifest. The output ZIP must be a new path outside the source checkout. See [release and hosting](docs/guides/release-and-hosting.md), [release QA](docs/release/README.md) and [performance budgets](docs/release/performance-budgets.md).

The Phase 0 route inventory distinguishes the original 11 legacy routes from the current catalog-preview manifest. Check it against the page and collection sources, or refresh its generated matrix after route changes:

```sh
yarn check:route-inventory
node qa/phase-0/check-route-inventory.cjs --write
node qa/phase-0/check-route-inventory.cjs --self-test-stale
```

The check runs in `yarn ci:build`; the stale-fixture mode confirms that a changed route is rejected.

To verify that the current customer build is repeatable, run the fixed-time two-build check:

```sh
yarn check:reproducible
```

That check uses `BUILD_NOW=2026-10-03T12:00:00.000Z` and compares every output file. The initial 11-page measurements in the framework plan are historical evidence; they cannot be regenerated from the current migrated source tree because the inherited working tree has no matching baseline tag/source snapshot. Current-build repeatability does not claim to reproduce those historical byte counts.

## UI Library

Open `/components/` after `yarn start`, or after `yarn build:preview` and `yarn preview`. The page is a living
reference for the project UI and contains examples for:

- Foundations: color tokens, type scale, statuses and surfaces
- Actions: buttons, icon buttons, links and tabs
- Forms: labels, inputs, select, datalist, textarea, fieldset, checkbox, radio, range and output
- Feedback: alerts, badges, empty states and validation messages
- Content: headings, lists, blockquotes, details/summary, mark, abbr, time, code and pre
- Data display: metrics, progress, meter and responsive tables
- Overlays: native dialog and toast notifications

The accessibility target is WCAG 2.2 AA. Static checks and focused browser evidence cover part of that target; the examples are not certified. Remaining manual checks are recorded in the [status ledger](docs/FRAMEWORK_IMPLEMENTATION_STATUS.md). See [browser support](docs/guides/browser-support.md) for CSS targets, runtime API requirements and tested coverage.

### Component conventions

Use semantic HTML first. Shared UI APIs and keyboard/lifecycle contracts live beside their modules in `src/ui/**`; the catalog consumes those same modules. Shared styles load once in core → theme → layout order; each page owns its composition styles and must not reimport those shared entries. Interactive components should keep
their accessible state in ARIA attributes (`aria-selected`, `aria-expanded`,
`aria-current`) and support keyboard focus.

The shared visual primitives live in `src/scss/base.scss`, with component-family styles in `src/scss/components`. Keep new selectors scoped to their owner. Customer changes belong in `project/overrides/`: brand/logo, semantic tokens, local fonts/custom Sass, navigation and custom pages. See [customization](docs/guides/customization.md) and [style ownership](docs/style-ownership.md).

## Page blueprints

The `/templates/` gallery is the catalog entry for page blueprints. New concrete pages declare `page.json`; manifest discovery owns entries and navigation. Reuse shared blocks/UI and `route(pageId)` for internal destinations, rather than maintaining a second manual route list.

| Route | Use case |
| --- | --- |
| `/components/` | Component reference and interaction samples |
| `/templates/` | Searchable template gallery |
| `/auth/login/` | Sign-in workflow |
| `/auth/register/` | Account creation workflow |
| `/auth/forgot-password/` | Password recovery workflow |
| `/dashboard/` | Admin and analytics workspace |
| `/commerce/catalog/` | Product browsing and cart workflow |
| `/marketing/` | SaaS marketing, pricing and FAQ landing page |

The routes above are catalog/development examples; selected customer packages may omit them. Complete catalog demos are at `/demos/agency/` and `/demos/saas/`. Inspect the current profile manifest before assuming a route is shipped.

```sh
yarn create:page --help
yarn create:component --help
yarn create:demo --help
```

## Structure

```text
build/              Manifest, routes, collections, profiles and build rules
config/             Site inputs and delivery profiles
src/pages/          page.json + Pug/style/script concrete page instances
src/content/        Blog, products and locale contracts
src/layouts/        Document and purpose-specific shells
src/blocks/         Reusable page composition
src/ui/             Shared UI modules and API docs
src/features/       Auth, catalog and cart capabilities
src/scss/           Core → theme → layout; page styles remain local
src/views/          Preserved original routes through the legacy bridge
project/overrides/  Optional customer-owned files
qa/, docs/          Acceptance checks, plan, ADRs, guides and evidence
.generated/, dist/  Generated files; never edit as source
```

Use [the guide index](docs/guides/README.md), [implementation status](docs/FRAMEWORK_IMPLEMENTATION_STATUS.md) and [continuation prompts](docs/FRAMEWORK_SESSION_PROMPTS.md) for extension boundaries and current remaining work.

## Contributing

Contributions are welcome! Feel free to open issues or create pull requests to improve this project.
