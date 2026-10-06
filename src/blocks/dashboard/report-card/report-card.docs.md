# Dashboard report card

Purpose: present a report summary with a local demo feedback action.

## Pug API

`+dashboardReportCard({ eyebrow, title, description, action, feedback })`

- All fields are required text and escaped by Pug.
- The action is a button (not a fake link) and displays the supplied demo-only feedback message through the page’s toast controller.
- No IDs or JavaScript listeners are embedded in the block. The page controller owns feedback mounting; the dashboard stylesheet owns visual styles.
