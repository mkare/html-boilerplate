# Marketing feature card

Purpose: render a feature card with an optional icon slot, highlighted layout, and short bullet list.

## Pug API

`+marketingFeatureCard({ eyebrow, title, description, iconTone, featured, bullets })`

- `eyebrow`, `title`, `description`, and `iconTone` are required. Icon tone is one of `violet`, `orange`, `mint`, `blue`, or `rose`.
- Optional Pug block content fills the decorative icon container. Keep it hidden from assistive technology or give meaningful icons an accessible name.
- `featured` spans two columns; `bullets` is an optional list of escaped text.
- No IDs or JavaScript are created. Styles remain owned by the consuming page at `src/views/marketing/marketing.scss`.
