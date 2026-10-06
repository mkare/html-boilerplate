# Commerce product card

Purpose: render one catalog product with its artwork, labels, details, quick-view actions, and add-to-bag action.

## Pug API

`+commerceProductCard({ product, detailHref, price, compareAtPrice })`

- `product`, `detailHref`, and `price` are required. `product` requires `id`, `name`, `description`, `category`, `rating`, `reviews`, `art`, `tone`, `shadow`, `stock`, and `isNew`; extra repository fields are ignored. `id` must be a lowercase hyphenated slug, `art` a CSS-safe token, `tone` and `shadow` exactly 3, 4, 6, or 8 hexadecimal digits after `#`, and `stock` is `ready` or `limited`.
- `detailHref` accepts a relative route, fragment, query, or an absolute `http`, `https`, `mailto`, or `tel` URL. It rejects unknown schemes, `javascript:` and `data:` URLs, protocol-relative URLs, whitespace, control characters, and backslashes. The consuming page owns the destination. `price` and optional `compareAtPrice` are already locale and currency formatted strings.
- There are no default product values. Pug escapes product text, prices, accessible names, and the detail href.
- Slots: none.
- The article exposes `data-product-id`; both quick-view controls expose `data-quick-view`; the add action exposes `data-add-product`. These selectors are the Commerce store controller API. Keep one catalog product ID unique per page.
- Semantics are an `article` with a product `h3`, a named rating, an inert decorative art surface, and native buttons/link. The block itself has no lifecycle; the page's Commerce controller binds its data selectors. Its styles belong to `src/views/commerce/store.scss`.
- The component renders once for each catalog item; multiple cards are expected. It requires the page's store controller and corresponding quick-view/cart dialogs for interactions.
