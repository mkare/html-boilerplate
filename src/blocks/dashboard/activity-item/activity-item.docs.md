# Dashboard activity item

Purpose: provide the avatar, timestamp, and status marker around a caller-owned activity sentence.

## Pug API

`+dashboardActivityItem({ initials, tone, datetime, timeLabel })` accepts optional Pug block content for the activity sentence, normally a `p` with escaped inline emphasis.

- Required text is escaped. `tone` is one of `violet`, `coral`, `mint`, or `gold`.
- The block does not create IDs or JavaScript state and can be repeated in any activity list.
- The dashboard page owns `.dashboard-activity*` and avatar styles.
