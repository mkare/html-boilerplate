import { readFileSync } from "node:fs";

// Load the ESM source directly without changing the project's CommonJS package
// setting, which is still required by its build scripts and content modules.
const source = readFileSync(new URL("../../src/features/cart/cart-model.js", import.meta.url), "utf8");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const cartModel = await import(moduleUrl);

export const {
  CART_STORAGE_KEY,
  LEGACY_CART_STORAGE_KEY,
  createCartModel,
} = cartModel;
