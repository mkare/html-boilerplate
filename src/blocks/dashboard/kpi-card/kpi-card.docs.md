# Dashboard KPI card

Purpose: show one labeled metric with its current value and comparison.

## Pug API

`+dashboardKpiCard({ id, label, value, badge, badgeTone, miniIcon, trend, trendDirection, comparison })`

- `label`, `value`, `trend`, `trendDirection`, and `comparison` are required. `trendDirection` is `up` or `down`; `badgeTone` is `up` or `neutral`.
- `id`, `badge`, and decorative `miniIcon` are optional. IDs must be unique within the rendered document.
- All text is escaped. This block has no JavaScript behavior and uses the dashboard page’s SCSS styles.
