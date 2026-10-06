# CLI scaffolds

The scaffold commands create files only. They do not edit `package.json`, register an unreviewed route in a central page list, or overwrite existing files. Each command supports `--root` so its output can be inspected in a fixture before use.

## Create a page

```sh
node scripts/create-page.cjs --id help.center --route /help/ --title "Help center"
```

Output:

```text
src/pages/custom/help-center/page.json
src/pages/custom/help-center/page.pug
src/pages/custom/help-center/page.scss
```

`--id` follows the page schema (`a-z`, digits, `.`, `_`, `-`); `--route` is a concrete root-relative route ending in `/` (or `/`). Layout and theme values must already appear in the project's page records or layout/theme sources. The CLI rejects malformed locales, noncanonical paths, existing IDs or routes (including routes in demo records), a pre-existing target directory, and symlinked path components. It generates a `page.json` with source/style ownership and an `@layouts/base.pug` page that links its local stylesheet and uses `route(pageId)` when producing a canonical URL.

Add internal page links as `href=route('page.id')`, using IDs present in the active profile. Add navigation through that page record's `navigation` fields; Webpack derives shell navigation from the selected manifest. Put user copy in escaped Pug output (`=` or `= props.value`) and keep page selectors in the page stylesheet.

## Create a UI component

```sh
node scripts/create-component.cjs status-chip --layer atoms
```

Output:

```text
src/ui/atoms/status-chip/status-chip.pug
src/ui/atoms/status-chip/status-chip.scss
src/ui/atoms/status-chip/status-chip.docs.md
```

Names are lowercase kebab-case. `--layer` accepts `atoms`, `molecules`, or `organisms`; the default is `molecules`. The starter Pug mixin validates a required escaped `label` with `assertProps`. The generated Sass owns only its `.ui-*` selectors. Static components have no JS entry; add a controller only when behavior needs one, and make that controller idempotent with a `destroy()` method.

## Create a demo preview scaffold

```sh
node scripts/create-demo.cjs field-notes --title "Field Notes"
```

Output:

```text
src/pages/field-notes/README.md
src/pages/field-notes/field-notes.scss
src/pages/field-notes/home/page.json
src/pages/field-notes/home/page.pug
```

The page is a `demoHome` at `/` and is starter-marked. Development and catalog preview mount it below `/demos/field-notes/`. The CLI requires `--home-route /`, rejects duplicate demo/page IDs and existing directories, and does not edit the build manifest. **Current customer builds accept only the completed `agency` and `saas` demo IDs.** A new one-page preview scaffold is not a complete customer package; finish its pages and request a root-owned profile-contract change before using it as `BUILD_DEMO` in customer production.

## Check a scaffold safely

```sh
node scripts/create-page.cjs --help
node scripts/create-component.cjs --help
node scripts/create-demo.cjs --help
node qa/release/test-scaffolds.cjs
```

All scaffolds refuse pre-existing targets. To review generated files without changing the app, pass `--root /tmp/your-fixture`.
