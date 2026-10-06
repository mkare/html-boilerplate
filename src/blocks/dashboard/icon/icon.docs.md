# Dashboard icon

Purpose: render the decorative inline SVG icon vocabulary for this dashboard demo.

## Pug API

`+dashboardIcon(name)` accepts `grid`, `chart`, `folder`, `users`, `invoice`, `gear`, `search`, `bell`, `sparkles`, `arrow`, `dots`, `close`, `menu`, or `plus`.

- Unknown names fail the build through `assertProps`.
- SVGs are hidden from assistive technology because interactive controls have their own labels.
- This demo-specific vocabulary is styled by `src/views/dashboard/dashboard.scss`; it is not a general icon package.
