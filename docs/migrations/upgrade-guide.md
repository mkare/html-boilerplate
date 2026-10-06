# Upgrade guide for framework releases

This guide preserves project work while framework source changes. It does not attempt a three-way merge or overwrite customer files.

## Before updating

1. Commit or archive the current project in your own version control. Keep a copy of the current release ZIP and its `release-manifest.json`.
2. Read both releases' `CHANGELOG.md`, `MIGRATION.md`, manifest version, Node requirement, and third-party notices.
   Review the [public API and compatibility policy](../guides/public-api-versioning.md) and each listed removal target.
3. Make a file inventory and classify each path as framework-owned, customer-owned, or generated. Use [Customization and file ownership](../guides/customization.md).
4. Record customer brand text/tokens, menu entries, added page records, page styles, and adapter changes separately from framework defaults.
5. Check the new release's supported demo/profile and route contract before merging new `page.json` IDs.

## Apply the update

1. Install the framework release's `source/` into a new clean directory; do not extract it over the current app.
2. Restore the project-owned overlay from source control. Keep project pages and blocks in their separate customer paths. Never replace `src/**` wholesale with customer-edited copies.
3. Reapply explicitly documented breaking API changes. Resolve duplicate page IDs/routes and update internal links to `route(pageId)`.
4. Restore the customer-owned `project/overrides/` overlay. The production loader reads supported `brand.json`, `theme.json`, `navigation.json`, `custom.scss`, and custom page records from that directory; keep referenced logos and fonts in their documented `public/` locations and use explicit asset imports in page content. See [Customization and file ownership](../guides/customization.md) for paths, precedence, validation, and fallback behavior. Invalid optional files are ignored with a warning and their framework defaults remain active.
5. Compare public theme tokens and component APIs. Update customer overrides after the framework defaults; do not edit generated HTML/CSS/JS under `dist/`.

## Development compatibility ledger

The current source is version `0.0.1`; these entries record migration boundaries before the first stable release. If an entry remains in the first `1.x` release, its deprecation notice and migration example must ship there. The earliest planned removal is a floor, not permission to remove an entry before its acceptance condition passes.

| Existing compatibility surface                                                       | Replacement                                                                                  | Removal target and acceptance condition                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/layouts/base.pug` and the `legacy` layout dispatch                              | Extend a named layout from a manifest-backed page wrapper.                                   | No earlier than `2.0.0`, after every retained legacy view either has a page record or a documented reason to remain, with route/output parity verified.                                                                     |
| `src/scss/main.scss` aggregate                                                       | Link/import the owned `core.scss`, `theme.scss`, `layout.scss`, and page stylesheet entries. | No earlier than `2.0.0`, after a repository scan finds no consumers and the production CSS ownership check passes.                                                                                                          |
| `body.theme-dark` and the unversioned `theme` storage key (values `light` or `dark`) | `html[data-theme]`, `html[data-color-scheme]`, and `interface-kit:color-scheme:v1`.          | Retain through **2027-10-03**; remove in `2.0.0` only after the compatibility fixtures pass through the final supported 1.x release. See the [layout/runtime contract](../architecture/phase-2/layout-runtime-contract.md). |
| `atelier-store-cart-v1` local-storage array                                          | Versioned `theme:commerce-demo:cart:v1` cart model.                                          | No earlier than `2.0.0`, after at least one published 1.x minor release has performed the migration and the legacy-key fixture remains covered through that release.                                                        |
| Transitional `build/pages/legacy.cjs` records                                        | Validated `src/pages/**/page.json` records and generated wrappers.                           | No earlier than `2.0.0`, after route/output, metadata, navigation, and asset ownership parity passes for every migrated view. Public routes remain stable.                                                                  |

These pre-release source comments are migration tracking, not a claim that a public `1.x` deprecation period has already elapsed. Record additional aliases in this table or in a linked feature migration note before merging them.

## Verify before deployment

Build with the exact Node release stated by `.nvmrc`; check all customer routes at `/` and the configured subpath. Run `qa/release/smoke-extracted.cjs` on a generated package, verify its CSP response header, and review metadata/canonical/sitemap scope. Compare raw and gzip budgets with the selected demo baseline. Confirm auth, payment, and newsletter flows still show their static-demo boundary or are connected to a real configured adapter.

## Isolated rehearsal

`node qa/release/rehearse-upgrade.cjs` constructs a temporary customer project with a brand, logo, theme tokens, menu, custom page, font, and Sass override. It loads that overlay through a standalone synthetic 1.0.0 reader, then through the production 1.1.0 loader, and checks that customer-owned files survive byte-for-byte. This exercises two distinct loader implementations and the file boundary with representative fixtures; it does not compare published release archives or prove compatibility between published versions.
