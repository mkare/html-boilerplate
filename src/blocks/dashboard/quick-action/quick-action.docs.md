# Dashboard quick action

Purpose: render one option inside the native dashboard action dialog.

## Pug API

`+dashboardQuickAction({ action, icon, tone, title, description })`

- All fields are required escaped strings except `icon` and `tone`, which are checked against the supported sets.
- The action value is consumed by `mountDashboard()` and appears in local confirmation text; it does not submit data.
- Dialog focus/open/close behavior is owned by the shared `mountDialogs()` controller. Styles are owned by the dashboard page stylesheet.
