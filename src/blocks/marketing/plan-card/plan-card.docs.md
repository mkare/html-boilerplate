# Marketing plan card

Purpose: render a pricing plan card that the marketing billing controller can update.

## Pug API

`+marketingPlanCard({ id, audience, name, description, monthly, yearly, period, billingCopy, action, actionTone, mark, markTone, popular, tag, currency, features })`

- Required values are `id`, `audience`, `name`, `description`, monthly and yearly price strings, period copy, initial billing copy, action label, and a non-empty features array.
- `actionTone` is `primary` or `outline`; `markTone` is `violet` or `orange`. All copy is escaped.
- The action targets `#newsletter`, preserving this page’s signup flow.
- `data-plan`, `data-price`, and `data-billing-copy` are the contract consumed by `mountMarketing()`.
- Styling belongs to the marketing page SCSS. No IDs or instance state are created.
