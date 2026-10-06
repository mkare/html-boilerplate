# Framework guides

- [CLI scaffolds](./cli-scaffolds.md): create a page, reusable UI block, or demo preview scaffold.
- [Component authoring](./component-authoring.md): choose the right layer and document a reusable UI component, block, theme, or demo.
- [Public API versioning](./public-api-versioning.md): SemVer, deprecation, compatibility aliases, and migration evidence.
- [Content, collections, and adapters](./content-and-adapters.md): choose HTML or source workflows, understand generated detail/pagination pages, and connect project-owned services at explicit adapter boundaries.
- [Customization boundaries](./customization.md): customer-owned overrides, tokens, local fonts, logos, navigation and upgrade treatment.
- [Release and hosting](./release-and-hosting.md): deterministic source/HTML/starter packaging and root/subpath deployment.
- [Browser support](./browser-support.md): CSS targets, JavaScript requirements, fallbacks and actual browser evidence.
- [Accessibility testing](./accessibility-testing.md): run axe-core against catalog-preview routes in light and dark modes and understand manual review limits.

Use Node 22.23.2 and Yarn Classic 1.22.22. `package.json` provides `create:page`, `create:component`, `create:demo`, `package:release`, `check:release`, `check:release:scaffolds` and `check:release:upgrade` Yarn aliases for corresponding Node scripts. `build:demo agency|saas [--profile <profile>]` selects a complete package; see the [root README](../../README.md) for profiles, preview and QA commands.
