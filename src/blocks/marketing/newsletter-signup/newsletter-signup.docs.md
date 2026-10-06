# Marketing newsletter signup

Purpose: render the email signup panel and accessible form state used by the Orbit marketing demo.

## Pug API

`+marketingNewsletterSignup({ idPrefix, title, description, note, kicker, emailLabel, placeholder, action })`

- `title`, `description`, and `note` are required escaped strings. `idPrefix` defaults to `newsletter` and must be unique per page instance.
- The form has no network endpoint. The current page controller performs only local format validation and an explicitly demo-only confirmation; no address is sent or stored.
- Email input/status hooks are scoped to each form (`data-marketing-email`, `data-marketing-status`) so multiple block instances do not collide.
- The consumer owns `.newsletter-*` styles. `mountMarketing()` owns submit/input listeners and cleanup.
