# Dashboard navigation

Purpose: render grouped workspace navigation with links and explicit demo-only actions.

## Pug API

`+dashboardNavigation({ groups })` accepts groups of `{ label, spaced, items }`. Each item has `label`, `icon`, and either a local `href` (optionally `active`/`count`) or a `feedback` message.

- All visible labels and feedback text are escaped by Pug. `icon` must be one of the names accepted by `dashboardIcon`.
- Active links receive `aria-current="page"`; buttons remain buttons for actions that have no route.
- The controller updates the active anchor after navigation clicks; this static demo does not provide route changes for feedback actions.
- Styling and page state are owned by `src/views/dashboard/dashboard.scss` and `src/views/dashboard/dashboard.js`.
