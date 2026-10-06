# Marketing FAQ list

Purpose: render progressive-enhancement FAQ disclosures using native `details` and `summary` elements.

## Pug API

`+marketingFaqList(items)` accepts an array of `{ question, answer }` text records.

- Both fields are required and escaped by Pug.
- The first answer starts open, matching the original Orbit marketing page. No JavaScript is required; keyboard behavior is native.
- The block has no IDs. The page owns `.faq-list` styling in `src/views/marketing/marketing.scss`.
