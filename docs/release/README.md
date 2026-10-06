# Release bundle contents

`node scripts/package-release.cjs` creates one deterministic ZIP from an explicit profile, demo, site origin, build timestamp, and optional base path.

| Path | Purpose |
| --- | --- |
| `html/` | Readable `release-html` pages with production-indexing metadata and optimized/hash-named assets. |
| `source/` | Editable source, the page/profile/build rules, Yarn lockfile, and release QA. `node_modules/`, `dist/`, `.generated/`, `.git/`, `.env*`, and npm's lockfile are excluded. |
| `starter/` | Static starter-profile output for the selected demo; every starter page is noindex. |
| `documentation/` | Guides, migration instructions, release notes, selected profile/accessibility ADRs, and dependency license inventory/texts. |
| `release-manifest.json` | Explicit build inputs, route inventory, file sizes, profile records, CSP hashes, budget report references, and dependency inventory count. It does not contain its own checksum or arbitrary process environment. |
| `checksums.sha256` | SHA-256 for every other package file, including the release manifest; the checksum file does not hash itself. |
| `CSP-HEADER.txt` | Strict HTTP CSP header for the exact HTML bundle. |
| `PERFORMANCE-MEASUREMENTS.*` | Raw/gzip file totals and per-page CSS/JS measurements. |
| `CHANGELOG.md`, `MIGRATION.md`, `THIRD-PARTY-NOTICES.md` | Version/build notes, upgrade steps, and dependency license inventory. |

The packager builds `release-html`, `starter`, and `catalog-preview` in a disposable source copy. Catalog-preview is verified for `noindex,follow` and not copied into the customer package. Production and starter metadata are checked independently.

## Reproduce

Use Node 22.23.2, the checked-in `yarn.lock`, and the same explicit `--demo`, `--site-url`, `--base-path`, and `--build-now`. The QA command packages twice and compares the ZIP bytes, then extracts root and subpath releases and checks them. ZIP entries have sorted names and fixed 1980 timestamps. Reproducibility is expected for the same source tree, installed lockfile dependency tree, Node patch release, and inputs.

## Dependency licenses

`documentation/licenses/inventory.json` contains a name, version, declared license, package source path, and any license files copied from the installed dependency tree. Review the full third-party notices for redistribution requirements. A package without a standalone text file still has its declared license expression recorded.
