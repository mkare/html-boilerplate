# Content, collections, and adapters

The release is a static multi-page site plus its editable source. Content builds
into HTML; the demo's local interactions do not provide a CMS, account service,
newsletter service, inventory, order handling, or payment processing.

## Edit the published HTML or rebuild from source

| Goal | Work in | What to expect |
| --- | --- | --- |
| Make a small, one-off copy edit to a deployed site | A copy of the extracted `html/` directory | The edit affects only that published copy. It does not update source or survive a rebuild. |
| Change templates, routes, components, product/blog data, or reusable styles | `source/` from the release, or your source checkout | Edit source and rebuild the selected demo. Keep project changes in `project/overrides/` where the customization guide supports them. |

For a source rebuild from a release archive:

```sh
cd source
yarn install --frozen-lockfile
SITE_URL=https://www.example.com BASE_PATH=/ BUILD_NOW=2026-10-03T12:00:00.000Z yarn build:demo saas
```

Choose `agency` when that is the selected demo. Set `BASE_PATH` to the exact
hosting directory, such as `/preview/theme/`, before building for a subpath.
`SITE_URL` is an origin, and `BUILD_NOW` fixes date-based content selection.
For a new distributable ZIP, use `yarn package:release` with explicit
`--demo`, `--site-url`, `--base-path`, `--build-now`, and a new external
`--out` path. The packager builds `html/`, `starter/`, `source/`, and
`documentation/` in an isolated copy. See [release and hosting](./release-and-hosting.md)
for extraction and deployment steps.

An edited `html/` directory is no longer byte-for-byte represented by the
release checksum list. If an HTML edit changes inline code, review and
regenerate the matching `CSP-HEADER.txt` policy too. Rebuild and package from
source when you need a repeatable, auditable release. Do not treat `dist/` or
`.generated/` as editable source; both are build outputs.

## Content, detail pages, and pagination

The blog is a build-time collection. Its records live in
`src/content/blog/posts.cjs`; the collection descriptor is in
`src/pages/blog/archive/page.json`; `src/pages/blog/archive/page.pug` renders
the archive and `src/pages/blog/_pagination.pug` renders its navigation. The
build validates record IDs, titles, descriptions, UTC publication/update dates,
tags, and unique normalized slugs. Draft and future-dated records are omitted
according to `BUILD_NOW`. Published records produce static article pages,
category pages, and as many archive pages as needed. The current descriptor
uses two posts per archive page and `/blog/` as its base route.

Pagination is real HTML navigation: page links use `route()` to point at
generated pages, and the current or unavailable destinations are not links.
Article, category, and archive URLs load as separate documents. Those links
and detail pages continue to work with JavaScript disabled; no client router or
backend fetch is required.

The Commerce example is also built from local source data. Product records are
in `src/content/products/products.cjs`; the page-build data in
`src/content/products/storefront.cjs` supplies the two catalog pages and
product detail records under `src/pages/commerce/products/`. The catalog and
detail links, including page-one/page-two navigation, are ordinary HTML links.
Without JavaScript, the rendered products and navigation remain available,
while filtering, sorting, cart updates, and quick view are unavailable.

## Bind a project service adapter

Authentication has an explicit JavaScript adapter seam. The current page entry
(`src/views/auth/login.js`) selects `createDemoAuthAdapter`; that adapter never
sends or stores credentials. For a project that already has a JSON endpoint,
replace the demo selection in a project-owned page entry or maintained source
fork with an explicit adapter, for example:

```js
import { createFetchAuthAdapter, mountAuthForm } from "@features/auth/form-controller";

const adapter = createFetchAuthAdapter({
  endpoint: "/replace-with-your-auth-endpoint",
});

document.querySelectorAll('[data-auth-form][data-auth-mode="login"]').forEach((form) => {
  mountAuthForm(form, { adapter });
});
```

Replace the placeholder with an endpoint your application actually operates.
The helper sends JSON and maps HTTP success, `422` field errors, `404`, and
other failures into the form controller's result states. Configure the
endpoint path for the actual deployment mount; this helper does not derive API
URLs from `route()`. The server still owns authentication, authorization,
validation, sessions, and credential handling.

The demo auth fields start disabled and are enabled by the JavaScript
controller; they are not a no-JavaScript sign-in path. See
`src/features/auth/form-controller.docs.md` for the adapter result contract and
lifecycle.

Other demos do not have that same injectable service contract today:

- `src/views/marketing/marketing.js` validates the newsletter field locally and
  displays a demo-only confirmation. Add and bind a project-owned submit
  controller to a real configured service before collecting subscriptions.
- `src/views/commerce/store.js` directly imports the local
  `productRepository` and `createCartModel`. `createProductRepository(records)`
  builds an in-memory repository; it is not a remote-data plugin. A live
  catalog needs a project-owned data integration and page/controller changes
  that handle asynchronous loading and request failures. The cart model's
  optional `storage` is a synchronous Web Storage interface, not a server cart.
- Checkout explicitly reports that no order or payment is submitted.

Do not deploy demo confirmations as evidence that a message, account, order, or
payment was sent. Keep service endpoints and integration code in project-owned
source or page entries; the static HTML package alone cannot provide a backend.
See [customization boundaries](./customization.md) for file ownership and
upgrade treatment.
