# Clean install and profile builds for the final source snapshot

Run date: 2026-10-06. This is a fresh, isolated source/dependency install of the current dirty worktree snapshot, not a historical clean Git baseline. Node 22.23.2, Yarn Classic 1.22.22, Webpack 5.111.1.

## Snapshot and install

- Archive: `/private/tmp/fw-clean-final-latest-20261006/source.tar`
- SHA-256: `eb65485296b4dea5f8a52dac0eabc88970cdf5361ff019ffde60eab41c468839`
- The extracted source has 383 regular files excluding `node_modules`, `dist`, `.generated`, `.git`, and `qa/framework-status-*`/`qa/framework-acceptance` evidence directories.
- `package.json` SHA-256: `2dba6bf783586fb9025065168500b6a77e9d23276ab43a6df9ae67f3ee5ea380`
- `yarn.lock` SHA-256: `f01db2821834c1ab3dc45e6af6bec7552378467d488685d6b4bbf8bbdc0c48a2`
- `package-lock.json` SHA-256: `1a8d257c2ffc5ec8448ca9ba71d59d3b1825c24989a94c678a5f3b09cb6f7020` and remains preserved.
- In `/private/tmp/fw-clean-final-latest-20261006/source`, `PATH=/Users/solvia/.nvm/versions/node/v22.23.2/bin:$PATH yarn install --frozen-lockfile --non-interactive` exited 0. The sandbox attempt failed DNS resolution for `registry.npmjs.org`; the isolated retry with approved network access completed in 3.51 seconds. No worktree `node_modules` was copied or linked.

## SaaS and Agency builds

All builds used `SITE_URL=https://phase5.invalid` and `BUILD_NOW=2026-10-03T12:00:00.000Z`.

- SaaS: `yarn build`, `yarn check:dist`, `EXPECTED_DEMO=saas EXPECTED_PROFILE=customer-production yarn check:profile` — exit 0; 22 HTML / 39 output files.
- Agency: `yarn build:demo agency`, `yarn check:dist`, `EXPECTED_DEMO=agency EXPECTED_PROFILE=customer-production yarn check:profile` — exit 0; 10 HTML / 25 output files, with canonical metadata verified under `SITE_URL`.
- `node --check qa/visual/acceptance.mjs`, `node qa/phase-3/check-catalog-source-parity.cjs`, and `PATH=... yarn check:release:upgrade` — exit 0. The upgrade fixture compares an independent synthetic historical 1.0.0 loader with the current production 1.1.0 loader; it does not claim to use published release archives.

The isolated build and install outputs stayed under `/private/tmp/fw-clean-final-latest-20261006/source`; they did not mutate the worktree `dist/` or `.generated/`.
