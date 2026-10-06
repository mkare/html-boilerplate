# Dashboard project row

Purpose: render one project table row with owners, status, progress, and a quick-action dialog opener.

## Pug API

`+dashboardProjectRow({ id, initial, tone, name, category, owners, ownersLabel, status, statusTone, progress, dueDate, dueLabel, actionLabel })`

- Required strings are escaped; progress is a number from 0 to 100.
- `owners` is an array of `{ initials, tone }` records, with tone `violet`, `coral`, `mint`, `gold`, or `navy`.
- `id` creates the row fragment and matching local link. Keep it unique in the document.
- The quick action targets `#dashboard-quick-action` through `aria-controls`; `mountDialogs()` owns opening/focus behavior.
- Markup styles belong to the dashboard page SCSS.
