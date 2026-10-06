# Isolated clean installation and selected-demo acceptance

Result: **PASS**. The clean install and builds used Node **22.23.2** / Yarn **1.22.22** in `/private/tmp/framework-clean-install-38yb73px`. This fixture never used the root `node_modules` directory or a dependency-directory symlink.

The source snapshot was created at **2026-10-05T12:44:37Z**, before the root's CLI, documentation and source-packaging fixes. It contains 289 files with per-file hashes in `clean-install-snapshot.json`; snapshot inventory SHA-256 is `6912df4b5bff367e91f0252b24eb090b23bc6c0adf0dfc02c78750cbe4b67140`. Git, generated outputs, release outputs, dependencies, local agent/secret directories, and `.env` files were excluded. The initial filter also mistakenly excluded nested `qa/release` and `docs/release` source directories. This does not affect the recorded clean dependency installation, compilation and `check:dist` results; it limits that initial snapshot's QA/documentation coverage. The final guarded source overlay corrects this by excluding only the top-level `release/` output directory.

| Command in fixture | Result | Evidence |
| --- | --- | --- |
| `yarn install --frozen-lockfile --non-interactive` inside sandbox | Stopped at dependency fetching with DNS `ENOTFOUND` | `clean-install.log` |
| Same install with approved network escalation | Exit 0; 1.90 seconds | `clean-install-escalated.log` |
| `BUILD_NOW=2026-10-03T12:00:00.000Z yarn build` | Exit 0; 2.68 seconds; customer-production SaaS | `clean-build.log` |
| `BUILD_NOW=2026-10-03T12:00:00.000Z yarn check:dist` | Exit 0; **21 HTML / 35 output files**, basePath `/` | `clean-dist.log` |

Every command above used `PATH=/Users/solvia/.nvm/versions/node/v22.23.2/bin:$PATH`. After installation and the initial build, all 289 snapshotted files remained byte-identical, including `yarn.lock` and `package-lock.json`. All **18 direct dev-dependency versions** and all **472 unique installed package name/version pairs** match the root's existing dependency tree; no dependency drift was found. Inventory: `clean-installed-dependencies.json`.

Nonfatal install warnings: the existing npm/Yarn lockfile pair; Bootstrap's unmet `@popperjs/core@^2.11.8` peer; workspaces limited to private projects. These did not prevent installation, compilation, or distribution checks. No dependencies or lockfiles were amended by this lane.

## Current CLI overlay verification

After the original clean-install result was established, only the root's current `package.json` and new `scripts/build-demo.cjs` were copied into the fixture at **2026-10-05T12:57:25Z**. A guard confirmed package changes were limited to scripts; dependency fields and lockfiles were unchanged. Exact overlay hashes are in `agency-cli-overlay.json`. Source-packaging/documentation fixes were not copied or verified by this fixture.

| Command after script-only overlay | Result | Evidence |
| --- | --- | --- |
| `BUILD_NOW=2026-10-03T12:00:00.000Z yarn build:demo agency` | Exit 0; 1.67 seconds | `clean-agency-cli.log` |
| `BUILD_NOW=2026-10-03T12:00:00.000Z yarn check:dist` | Exit 0; **9 HTML / 21 output files**, basePath `/` | `clean-agency-dist.log` |
| `BUILD_NOW=2026-10-03T12:00:00.000Z yarn check:profile` | Exit 0; **customer-production / agency**, 9 routes (8 package pages); selected home `/`; links/metadata passed | `clean-agency-profile.log` |

This establishes the literal plan §11 `yarn build:demo agency` developer workflow with dependencies installed cleanly from the frozen Yarn lockfile. The fixture remains under `/private/tmp` for review; root outputs were not modified. Release acceptance after the root's packaging fixes is owned by the root lane.

## Tool availability

Before any lint/format implementation, exact root `require.resolve('prettier')` and `require.resolve('eslint')` both returned `MODULE_NOT_FOUND`. Neither package was installed by this verification lane.

## Current Sharp-inclusive frozen installation and demo builds

Result: **PASS**. This refresh was required because the worktree added exact `sharp@0.35.5` after the preceding clean-install result. Node **22.23.2** / Yarn **1.22.22** ran in `/private/tmp/theme-fw-clean-install.ZYk4Lr`. The independent source snapshot contains **439 files**, inventory SHA-256 `ec08a04f7eb265dbfeae6c5bffe4f8bfbb4e20c9420e7682f974b86bb3898747`, with `.git`, `node_modules`, `dist`, and `.generated` excluded. It did not use the worktree dependency directory or a dependency symlink.

| Command in the isolated snapshot | Result |
| --- | --- |
| `PATH=/Users/solvia/.nvm/versions/node/v22.23.2/bin:$PATH yarn install --frozen-lockfile` | Sandbox DNS initially returned `ENOTFOUND registry.npmjs.org`; the same command then completed with the approved network escalation, exit 0, Yarn reported 3.73 seconds. |
| `PATH=/Users/solvia/.nvm/versions/node/v22.23.2/bin:$PATH BUILD_NOW=2026-10-03T12:00:00.000Z yarn build` | Exit 0; 2.83 seconds; SaaS customer production. |
| `PATH=/Users/solvia/.nvm/versions/node/v22.23.2/bin:$PATH BUILD_NOW=2026-10-03T12:00:00.000Z yarn check:dist` | Exit 0; **21 HTML / 36 output files**, basePath `/`. |
| `PATH=/Users/solvia/.nvm/versions/node/v22.23.2/bin:$PATH BUILD_NOW=2026-10-03T12:00:00.000Z yarn build:demo agency` | Exit 0; 1.74 seconds; Agency customer production. |
| `PATH=/Users/solvia/.nvm/versions/node/v22.23.2/bin:$PATH BUILD_NOW=2026-10-03T12:00:00.000Z yarn check:dist` | Exit 0; **9 HTML / 22 output files**, basePath `/`. |
| `PATH=/Users/solvia/.nvm/versions/node/v22.23.2/bin:$PATH BUILD_NOW=2026-10-03T12:00:00.000Z yarn check:profile` | Exit 0; Agency customer production, 9 routes (8 package pages), selected home `/`; links and metadata passed. |

After installation/build, the snapshot inventory remained **439 files** with the SHA-256 above. `package.json`, `yarn.lock` and `package-lock.json` remained equal to the originating worktree hashes: `823de4c8719b48e5287954f214d7ef1c48fb1a98d7d64865e8b262d4fa578ee9`, `80674ac6db2053151e7ebf2d6694e62c60f1338c48c21ad9403951bef831b5e8`, and `1a8d257c2ffc5ec8448ca9ba71d59d3b1825c24989a94c678a5f3b09cb6f7020`. Nonfatal warnings noted the existing npm/Yarn lockfile pair, Bootstrap's unmet `@popperjs/core` peer, and Yarn's workspace/private-project notices. No root outputs or lockfiles were changed.
