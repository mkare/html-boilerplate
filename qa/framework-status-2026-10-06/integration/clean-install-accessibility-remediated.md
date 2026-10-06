# Isolated frozen install and demo builds after accessibility remediation

Run date: 2026-10-06. This verifies the current implementation source snapshot, not a historical Git baseline. Node 22.23.2, Yarn Classic 1.22.22, Webpack 5.111.1.

## Snapshot and dependency install

- Worktree source archive: `/private/tmp/fw-clean-final-cbb4c2/source.tar`.
- Archive SHA-256: `261edac1c4696d1857295cc80197854099014ce2c30801e5c498010e25f1cf5a`; 658 regular files in the extracted source tree excluding `node_modules`, `dist`, and `.generated`.
- `package.json` SHA-256: `838245618f620ef279cd462072056194da645c9b66fa9807b9d6062838f6f1e9`.
- `yarn.lock` SHA-256: `f01db2821834c1ab3dc45e6af6bec7552378467d488685d6b4bbf8bbdc0c48a2`.
- `package-lock.json` SHA-256: `1a8d257c2ffc5ec8448ca9ba71d59d3b1825c24989a94c678a5f3b09cb6f7020` (preserved; Yarn remains the declared package manager).
- In `/private/tmp/fw-clean-final-cbb4c2/source`, `PATH=/Users/solvia/.nvm/versions/node/v22.23.2/bin:$PATH yarn install --frozen-lockfile --non-interactive` passed (exit 0) after the sandbox attempt failed to resolve `registry.npmjs.org`; the approved network retry completed. This created a fresh `node_modules` in the isolated source directory.

## Isolated builds

All build commands used `SITE_URL=https://phase5.invalid` and `BUILD_NOW=2026-10-03T12:00:00.000Z`.

- SaaS: `yarn build`, `yarn check:dist`, `EXPECTED_DEMO=saas EXPECTED_PROFILE=customer-production yarn check:profile` — all exit 0; 22 HTML / 39 output files.
- Agency: `yarn build:demo agency`, `yarn check:dist`, `EXPECTED_DEMO=agency EXPECTED_PROFILE=customer-production yarn check:profile` — all exit 0; 10 HTML / 25 output files. Canonical metadata passed with `SITE_URL` configured.

The builds were run in the isolated extracted snapshot and did not mutate the worktree’s `dist/` or `.generated/`.
