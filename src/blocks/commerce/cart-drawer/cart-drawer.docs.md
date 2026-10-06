# Commerce cart drawer

Purpose: provide the modal bag dialog, empty state, cart item mount point, shipping progress, subtotal, and demo checkout action.

## Pug API

`+commerceCartDrawer(options = {})`

All props are optional. Defaults: `kicker: Your selection`, `title: Bag`, the current empty-bag title and description, `$150` shipping message, `Subtotal`, the demo totals notice, `Checkout preview`, `Close shopping bag`, and `Keep browsing`. Overrides are `kicker`, `title`, `emptyTitle`, `emptyDescription`, `shippingMessage`, `subtotalLabel`, `notice`, `checkoutLabel`, `closeLabel`, and `keepBrowsingLabel`. Text is escaped by Pug.

Slots: none. The cart dialog is a single instance because the Commerce controller mounts to stable IDs: `store-cart`, `store-cart-title`, `store-cart-items`, `store-cart-empty`, `store-cart-footer`, `store-cart-announcement`, `store-cart-subtotal`, `store-shipping-copy`, and `store-shipping-progress`. Keep the `data-cart-count` span and `data-demo-checkout` action. The page shell owns the separate `[data-open-cart]` trigger.

The native `<dialog>` is named by its `h2`; close and keep-browsing controls use native `method=dialog` forms. The announcement is a polite live region and shipping progress exposes progressbar semantics. Item actions and state are rendered by `src/views/commerce/store.js`; this block has no independent lifecycle. Styles belong to `src/views/commerce/store.scss`.
