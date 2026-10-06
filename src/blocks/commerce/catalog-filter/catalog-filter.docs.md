# Commerce catalog filter

Purpose: provide the collection rail, text search, sort selector, responsive filter trigger, and filter form for the current catalog page.

## Pug API

`+commerceCatalogFilter({ categories, colors })`

- `categories` and `colors` are required arrays. A category has `{ label, value }`; values are lowercase slugs and one category must use `all`. A color has `{ label, value, swatch }`; values and swatches are lowercase CSS-safe tokens.
- The nested Pug block is required page-owned content and is placed after the filter panel inside `.store-catalog__layout`; the storefront passes its `.store-products-region` there.
- There are no default data values. Search, sort choices, stock, price range, and visible English labels have the storefront defaults in the template. Pug escapes category and color labels.
- This is a single instance per storefront document because the Commerce controller and its labels refer to stable IDs: `store-search-input`, `store-sort`, `store-filter-panel`, `store-filter-form`, `store-price-range`, and `store-price-range-output`.
- The block preserves `data-category-chip`, `data-store-search`, `data-store-sort`, `data-filter-toggle`, `data-filter-category`, `data-filter-color`, `data-filter-stock`, `data-filter-price`, and `data-reset-filters` selectors used by `src/views/commerce/store.js`.
- The required nested content slot supplies the page's `.store-products-region`, placed after the filter panel inside `.store-catalog__layout`.
- Semantics use a named toolbar, native search/select controls, grouped fieldsets with legends, labels, and a button that updates `aria-expanded` through the store controller. No-JS retains the catalog controls but the responsive filter panel's open/closed state is controller-enhanced. Styles belong to `src/views/commerce/store.scss`.
