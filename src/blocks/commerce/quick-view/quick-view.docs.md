# Commerce quick view

Purpose: show product details in the storefront's modal quick-view dialog.

## Pug API

`+commerceQuickView(options = {})`

All props are optional. Defaults preserve the starter storefront's Orion table lamp content: `art: lamp`, its indigo tones, category, title, description, rating, reviews, price, compare-at price, availability, quantity label, quantity group label, close label, add label, and shipping/returns note. Supported overrides are `art`, `tone`, `shadow`, `category`, `title`, `description`, `rating`, `reviews`, `price`, `compareAtPrice`, `availability`, `quantityLabel`, `quantityGroupLabel`, `closeLabel`, `addLabel`, and `note`. `quantityLabel` defaults to `Quantity`; `quantityGroupLabel` defaults to `Choose quantity`. `art` is a CSS-safe token and both colors are exactly 3, 4, 6, or 8 hexadecimal digits after `#`. Text is escaped by Pug.

Slots: none. The block is a single instance per document. IDs `quick-view-dialog`, `quick-view-art`, `quick-view-category`, `quick-view-title`, `quick-view-description`, `quick-view-rating`, `quick-view-reviews`, `quick-view-price`, `quick-view-compare`, `quick-view-availability`, `quick-view-quantity`, and `quick-view-add`, plus `[data-quick-view-adjust]`, are read and updated by `src/views/commerce/store.js`. Keep its native `<dialog>` and `aria-labelledby` association. The quantity controls use a named `role="group"`; the stepper buttons and input retain their individual accessible names. Native method=dialog close and live product content remain available; the store controller uses `showModal()` and `close()` and updates product details, quantity, and add-to-bag behavior. Styles belong to `src/views/commerce/store.scss`.
