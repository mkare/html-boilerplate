# Shared header

## Purpose

Render the site navigation, home link, and color-scheme control for `site`, `docs`, and `storefront` layouts. The `auth` layout keeps only the home link and theme control. The `dashboard` layout keeps the theme control; its workspace owns its own navigation. `minimal` and `agency` layouts do not render this component.

## Template data

- `mainNavigation`: manifest-derived `{ pageId, label, order }` records. The template passes every internal page ID through `route(pageId)` and does not contain a route list.
- `pageId`: used to render the active item as `aria-current="page"`.
- `layout`: selects the shell variant.
- `homePageId` and `demoBrand`: optional profile locals for a package-scoped brand link and name. Legacy pages fall back to `legacy.home` and `Interface Kit`.
- `locale` and `route`: page locale for labels and the canonical internal-link helper.
- `@images/compass.svg`: decorative brand mark; its alternative text is empty because the adjacent brand link has a name.

## Behavior and accessibility

The header starts with all navigation links visible. The mobile menu button is hidden until `mountHeader()` completes; only then does CSS collapse the links behind the button. The button's `aria-controls` and `aria-expanded` describe the matching list. The controller repairs duplicate list IDs when multiple header roots are mounted. Escape closes the menu and returns focus to the toggle; selecting a link or clicking outside closes it.

The theme control is hidden until the controller attaches. It updates the root `data-color-scheme` and Bootstrap `data-bs-theme` values, synchronizes its accessible name and pressed state, and still works when storage is denied. Its target and menu links meet the project's 44 CSS px target. Global `:focus-visible` styling supplies the focus ring.

## Runtime API

- `mountHeader(root = document, options = {})` finds the root header or first descendant, returns the existing controller on repeat mount, and otherwise returns `{ destroy() }`.
- `mountStickyHeader(root = document, options = {})` owns only the observer and its sentinel. It is independently idempotent and returns `{ destroy() }`. `mountHeader()` starts it unless `options.sticky === false`.
- `mountShell(root = document, options = {})` discovers and owns all header and footer roots under its input. A root belongs to one shell mount owner.

`destroy()` removes menu, theme, storage, and OS-preference listeners; disconnects the sticky observer; removes the sentinel; resets the open state; and allows the same element to be mounted again. A repaired navigation ID remains paired with its `aria-controls` value across destroy/remount.
