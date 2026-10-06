# Release and hosting

Builds require Node 22.23.2 and Yarn Classic 1.22.22. The release packager rebuilds in a temporary copy of the source tree so it does not replace this checkout's `dist/` or `.generated/` outputs.

## Make a deterministic package

```sh
node scripts/package-release.cjs \
  --demo saas \
  --site-url https://www.example.com \
  --build-now 2026-10-03T12:00:00.000Z \
  --out /tmp/saas-release.zip
```

Choose `--demo agency` for the Agency pack. `--base-path /` is the default. For a site hosted below a directory, pass a canonical path such as `--base-path /preview/theme/`; the emitted links, canonical URLs, and asset URLs use that mount. `--site-url` must be an origin (no path or credentials). `--build-now` requires an explicit timezone and is normalized to UTC. The output ZIP must not already exist and is written outside the source project.

The command builds three isolated outputs from the same fixed inputs:

1. `release-html` for readable production HTML and optimized assets.
2. `starter` for the selected demo's starter-marked pages with `noindex,nofollow`.
3. `catalog-preview` for noindex metadata and both demo examples; it is checked and omitted from the customer release.

No process environment values are serialized into the archive manifest. Only the explicit demo, origin, base path, and normalized build time appear there.

## Deploy a ZIP

Extract the archive to a clean directory and open `html/index.html` through a static HTTP server or static host. This is a multi-page site: configure the host to serve directory indexes and the supplied `404.html`; do not add SPA fallback routing. If the package was built with a non-root `--base-path`, mount its `html/` contents at exactly that path. A ZIP built at `/` cannot be relocated under an arbitrary subpath without rebuilding because its URLs are intentionally absolute and canonical.

Review `CSP-HEADER.txt` and install that policy as an HTTP response header for the packaged HTML. It contains hashes for the first-paint theme script and any emitted inline style fragments. The hashes are specific to the exact HTML bytes in that release and need regeneration after HTML changes. The policy does not include `unsafe-inline` or `unsafe-eval`.

Before publishing a copied/extracted ZIP, run:

```sh
node qa/release/smoke-extracted.cjs /tmp/saas-release.zip
node qa/release/check-csp.cjs /tmp/extracted-release
```

`smoke-extracted` verifies the archive's checksums and license inventory, routes, fragments, HTML assets, CSS URLs, production metadata, and starter metadata. `check-csp` expects an already-extracted package root.

## Cache headers

Keep document responses short-lived so a deployment can replace HTML references promptly. Serve content-hashed assets with a long immutable lifetime:

| Response | Suggested `Cache-Control` | Reason |
| --- | --- | --- |
| HTML, including `404.html` | `public, max-age=0, must-revalidate` | The next request revalidates the page and picks up new asset hashes. |
| Hashed CSS, JavaScript, fonts, and images | `public, max-age=31536000, immutable` | Content changes produce a new URL, so a cached file does not mask an update. |
| Unhashed public files | `public, max-age=0, must-revalidate` | These filenames can keep the same URL when their bytes change. |

Apply headers by response path and confirm the deployed host does not rewrite `ETag` or `Last-Modified` validation unexpectedly. For private content, replace `public` with the host's appropriate private policy.

## Static release limits

The release provides HTML, CSS, JavaScript, images, and source. Auth, payments, newsletters, CMS, and server-side access control still require a backend or adapter. The package's robots, CSP, and build manifest are not an access-control boundary.
