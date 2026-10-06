<div class="docs-anchor" id="anatomy" aria-hidden="true"></div>

## Component anatomy starts with a clear contract

A component is more than a styled rectangle. It has a purpose, a semantic root, a small set of predictable states and an API that another person can understand at a glance. When those choices are deliberate, a marketing page, dashboard and checkout can feel related without becoming identical.

Start with the smallest useful version. A card might only need an `article`, a heading, supporting copy and one link. Make the baseline useful before adding an image treatment, a hover state or a JavaScript enhancement.

> **A useful default:** if the content still makes sense with CSS disabled, the component has a strong foundation.

### Name layers by responsibility

- **Block** — the independent pattern, such as `.feature-card`.
- **Element** — a part of that pattern, such as `.feature-card__title`.
- **Modifier** — a purposeful variation, such as `.feature-card--featured`.

This keeps page-specific styles local, while shared primitives such as `.button`, `.ui-card` and `.ui-pill` remain easy to recognise everywhere.

<div class="docs-anchor" id="composition" aria-hidden="true"></div>

## Compose pages from stable primitives

The library is HTML-first by design. Prefer an anchor for navigation, a button for an action, a `form` for submitted data and a `dialog` for a modal decision. The browser then supplies a dependable baseline for focus, keyboard input and assistive technology.

```pug
article.feature-card
  p.eyebrow Workflow
  h3.feature-card__title Make progress visible.
  p.feature-card__copy Keep one focused idea in each card.
  a.ui-link(href="/components") Explore the pattern →
```

The Pug above produces ordinary HTML. The class names only describe appearance; the `article`, heading and link describe meaning.

```html
<article class="feature-card">
  <p class="eyebrow">Workflow</p>
  <h3 class="feature-card__title">Make progress visible.</h3>
  <p class="feature-card__copy">Keep one focused idea in each card.</p>
  <a class="ui-link" href="/components">Explore the pattern →</a>
</article>
```

<div class="docs-anchor" id="content-rhythm" aria-hidden="true"></div>

## Give content a comfortable rhythm

Readable interfaces depend on restraint. Keep paragraphs short, constrain prose to a sensible measure and use headings to make the document scannable. A visual system earns its character from repeatable decisions—spacing, contrast, rounded corners and type—not from a new flourish in every section.

### Use hierarchy to answer questions early

1. What is this page for?
2. What should the person notice first?
3. What can they do next?

Use metadata for useful context rather than decoration. A publish date, status, owner or reading time gives a person confidence that they are looking at the right thing. Supporting information should remain quieter than the main action.

> **Content note:** headings should describe the section that follows. “Implementation details” is more useful in a table of contents than “More information.”

<div class="docs-anchor" id="implementation" aria-hidden="true"></div>

## Keep implementation small and visible

Shared design decisions live in CSS custom properties. A page consumes those variables instead of creating a parallel colour system, which lets light and dark themes stay coherent with very little extra code.

```scss
.feature-card {
  padding: clamp(1.25rem, 3vw, 2rem);
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}
```

JavaScript should enhance an already understandable interface. Keep selectors close to the component, guard optional elements and rely on native behavior where it exists.

```js
const dialog = document.querySelector("#delete-dialog");
const trigger = document.querySelector("[data-open-delete-dialog]");

trigger?.addEventListener("click", () => dialog?.showModal());
```

That optional chaining is intentional: a shared script can safely load on a page where the component is not present.

<div class="docs-anchor" id="accessibility" aria-hidden="true"></div>

## Design each state for real use

Accessibility is part of the component contract, not a review step at the end. A polished pattern has a visible focus state, enough colour contrast, a keyboard path and honest labels. If a state is important, expose it in the markup instead of implying it through colour alone.

### A short review before shipping

- Can every interactive control receive focus in a sensible order?
- Does the label explain what will happen, rather than only what the control looks like?
- Is a disabled or loading state communicated in text where appropriate?
- Does the layout remain useful at narrow widths and with larger text?

For custom interactions, preserve the native behavior people expect. Tabs need arrow-key movement; dialogs need a clear close path; status changes need an appropriate live region. If that feels heavy for the problem, a native element is often the better component.

<div class="docs-anchor" id="tokens" aria-hidden="true"></div>

## Let tokens carry the visual language

Tokens keep the interface recognisable as it grows. They describe what a value means instead of where it happens to be used. `--color-surface` can change with a theme; `--radius-lg` can evolve across every card; `--transition-fast` keeps movement consistent without repeating magic numbers.

| Token | Role | Use it for |
| --- | --- | --- |
| `--color-surface` | Elevated background | cards, menus and dialogs |
| `--color-border` | Quiet separation | outlines, dividers and table rows |
| `--radius-lg` | Generous grouping | feature cards and page panels |
| `--shadow-card` | Low-elevation depth | interactive surfaces |
| `--transition-fast` | Short feedback | hover and theme transitions |

The result is a system that remains intentionally minimal while giving every new page enough visual vocabulary to feel complete.
