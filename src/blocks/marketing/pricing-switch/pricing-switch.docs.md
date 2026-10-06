# Marketing pricing switch

Purpose: expose the monthly/yearly radio-style control and its live announcement region.

## Pug API

`+marketingPricingSwitch({ idPrefix, label, monthly, yearly, savings })`

- All values are optional escaped strings. `idPrefix` defaults to `pricing` and must be unique if multiple switches appear in one document.
- The static default selects monthly pricing. `marketing.js` enhances the radios and updates pricing nodes within the same `.marketing` root.
- Keyboard behavior is left/right and Home/End through the group; focus remains on the selected radio.
- Styles belong to `src/views/marketing/marketing.scss`. JavaScript lifecycle is owned by `mountMarketing()` in `src/views/marketing/marketing.js`.
