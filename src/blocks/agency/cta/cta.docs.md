# Agency call to action

Purpose: render the repeated closing prompt used across the Agency demo pages.

## Pug API

`+agencyCta({ eyebrow, title, action, href })`

- All four props are required non-empty strings. Pass internal links through `route()` at the call site.
- Text and the `href` attribute are escaped by Pug. The arrow is decorative and hidden from assistive technology.
- The block emits the existing `.agency-shell.agency-cta` structure. Its visual rules remain owned by `src/pages/agency/agency.scss`.
- It has no JavaScript behavior or generated IDs.

## Example

```pug
include @blocks/agency/cta/cta.pug

+agencyCta({ eyebrow: "A real example", title: "See how a clear point of view shaped Northline House.", action: "View the project", href: route("agency.project.northline") })
```
