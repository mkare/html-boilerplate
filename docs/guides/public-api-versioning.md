# Public API and compatibility policy

This policy covers documented Pug mixins and props, slots, public CSS classes and custom properties, data attributes, page/content schemas, JavaScript exports, event names and payloads, route/profile inputs, and supported project override files. A source detail is not a supported extension point unless a guide, schema, or adjacent `*.docs.md` identifies it as public.

## Version changes

The first published stable framework release establishes the `1.0.0` compatibility contract. Before that release, changes may still be breaking; release notes and migration guidance must identify them. After `1.0.0`, use Semantic Versioning:

- **Patch:** compatible fixes and documentation corrections.
- **Minor:** backward-compatible additions, new optional props, new token hooks, and new adapters.
- **Major:** removal or incompatible change to any public API listed above, including default behavior that changes rendered markup or required integration.

Do not rely on implementation details such as private Sass partials, internal helper paths, generated output filenames, or undocumented selectors.

## Deprecation and migration

When replacing a public API, add the replacement first and keep the old surface working as a compatibility alias for at least one published minor release. Emit a source-quality or development warning when practical, without exposing customer data. Document the old and new signatures, conversion steps, and the earliest major release that can remove the old form. Remove it only in a major release, except when a security issue requires a shorter window and the release note explains the reason.

Every compatibility alias has a ledger entry in `docs/migrations/upgrade-guide.md` or the linked feature migration note with:

| Field                   | Required record                                                        |
| ----------------------- | ---------------------------------------------------------------------- |
| Old and replacement API | Exact prop/token/data attribute/export/route and supported replacement |
| Introduced              | Framework version that added the replacement and deprecation           |
| Removal target          | Earliest major version allowed to remove the alias                     |
| Migration               | Before/after example and any changed output or behavior                |
| Validation              | Focused check proving the replacement and temporary alias behavior     |

The existing theme storage/body-class compatibility is a concrete example: the compatibility window is recorded in the [layout/runtime contract](../architecture/phase-2/layout-runtime-contract.md). Do not add an alias without recording its owner and removal target.

## Extension contract

Document every public component prop's required status, default, accepted values, escaping, and HTML effect. Document public classes and CSS tokens alongside their owner; document each data attribute's values and whether it is read or written by JavaScript. For events, record the exact event name, dispatch target, payload shape, cancellation behavior, and lifecycle. Schema changes must preserve unknown-field behavior intentionally and include valid/invalid fixtures.

Project-owned files and supported adapters remain outside framework-owned defaults. See [Customization and file ownership](./customization.md) and the [upgrade guide](../migrations/upgrade-guide.md) before changing that boundary.
