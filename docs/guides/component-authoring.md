# Authoring components, blocks, themes, and demos

Use the smallest layer that matches the responsibility:

- `src/ui/` contains presentation primitives that can serve unrelated page families. Keep their public Pug API and styles local to the component.
- `src/blocks/<domain>/` contains composed sections with domain meaning, such as a marketing feature card or dashboard KPI. A block may compose UI components and other documented blocks.
- `src/features/` contains reusable behavior and data rules without owning page composition. Keep DOM rendering in a block or UI component unless the behavior itself is a controller for an existing view.
- `src/pages/` owns complete route records and page composition. A page includes its blocks and owns page-level layout styles.
- Theme values belong in the semantic token layer and documented theme overrides. A demo chooses and composes tokens; it should not redefine shared component meaning with page-specific selectors.

## Create a reusable UI component

Start with the [component scaffold](./cli-scaffolds.md#create-a-ui-component):

```sh
node scripts/create-component.cjs status-chip --layer atoms
```

The scaffold writes a Pug mixin, a component stylesheet, and a `*.docs.md` API page. Keep the mixin prefix and selector namespace unique. Validate required and enumerated props with `assertProps`; render user-provided text through escaped Pug output. Do not build HTML with `innerHTML`.

Each `*.docs.md` file records purpose, include path, mixin signature, every prop and default, accepted values, slots, emitted attributes, variants, public CSS tokens, semantic markup, keyboard and focus behavior, JavaScript/no-JavaScript behavior, multiple-instance and ID rules, lifecycle methods, and custom event names/payloads. State explicitly when a capability does not exist yet, such as an error prop or controller.

Import component Sass from an owning page or a documented shared stylesheet. Component Sass must not import a layout or page entry. Use semantic CSS tokens, low-specificity selectors, visible `:focus-visible` styling, and reduced-motion handling for animation. Add JavaScript only for behavior that native HTML cannot provide; controllers must be safe to mount twice and expose cleanup when they register listeners or observers.

## Create a domain block

There is no block scaffold yet. Add a directory below `src/blocks/<domain>/<block-name>/` with a Pug include and a companion `*.docs.md`. Add a stylesheet only when the block has reusable presentation rules; otherwise let the consuming page own its composition styles. Keep data and interactions in `src/features/` when multiple pages need those rules. Use a representative catalog page to demonstrate the block and add a focused source or output check for its public API.

Blocks should accept content and actions as explicit props or Pug block content rather than reach into a page's data object. Keep links as real destinations and forms as native forms. IDs must be caller-supplied or generated from a documented unique prefix; do not create duplicate fixed IDs. Mark decorative icons hidden from assistive technology and provide text alternatives for meaningful images.

## Add a theme or demo

Define theme choices with semantic token values, then verify light, dark, and system color schemes. Keep component semantics and structure stable across themes. Check text and non-text contrast, focus indicators, form controls, and long-copy wrapping in each scheme. Theme selection belongs to the page record/profile or supported project override; avoid deriving it from a route substring.

Use the [demo scaffold](./cli-scaffolds.md#create-a-demo-preview-scaffold) for a preview seed, then complete the page set and content records before requesting the profile contract to include it in customer builds. Each route uses a validated `page.json`; the manifest is the source of navigation, sitemap, and output routes. Provide real localized copy and route metadata before enabling a locale. Do not duplicate a locale page with untranslated placeholder text.

## Review and acceptance

Before merging a new UI element or block:

1. Run its scaffold or schema checks and the source-quality commands in [Source quality](./source-quality.md).
2. Confirm its documented API matches the rendered HTML and stylesheet.
3. Exercise empty, long-copy, invalid-prop, keyboard, reduced-motion, no-JavaScript, and multiple-instance cases that apply to the feature.
4. Check its page at 320 CSS px and at the supported wider viewports; inspect focus, contrast, target size, and theme states.
5. Verify the selected production profile includes only the required CSS and JavaScript, and inspect the generated routes and local asset references.

See [CLI scaffolds](./cli-scaffolds.md), [page and route contracts](../architecture/phase-5/profiles-and-routes.md), and [the public API policy](./public-api-versioning.md) for the related contracts.
