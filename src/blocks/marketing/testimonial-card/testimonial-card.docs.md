# Marketing testimonial card

Purpose: render a customer quote with an avatar monogram, visible rating, and attribution.

## Pug API

`+marketingTestimonialCard({ initials, wrapInitials, ratingLabel, ratingText, quote, author, role })`

- `initials`, `ratingLabel`, `ratingText`, `quote`, `author`, and `role` are required non-empty strings. Keep `ratingLabel` and `ratingText` consistent; the visible rating is hidden from assistive technology, which receives `ratingLabel` instead.
- `wrapInitials` is optional and defaults to `false`; use it only when the consuming markup needs a span around the monogram.
- All prop text is escaped. The avatar is decorative and hidden from assistive technology.
- The block emits the existing `.testimonial-card` markup. Styling remains owned by the consuming marketing page at `src/views/marketing/marketing.scss`.
- It has no JavaScript behavior or generated IDs.

## Example

```pug
include @blocks/marketing/testimonial-card/testimonial-card.pug

+marketingTestimonialCard({ initials: "RA", ratingLabel: "Five out of five stars", ratingText: "★ ★ ★ ★ ★", quote: "The team has enough context to make a decision.", author: "Rhea Alvarez", role: "VP Product, Northstar" })
```
