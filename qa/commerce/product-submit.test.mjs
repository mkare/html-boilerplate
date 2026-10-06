import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createCartModel } from "./cart-model-loader.mjs";

const require = createRequire(import.meta.url);
const products = require("../../src/content/products/products.cjs");
const productsById = new Map(products.map((product) => [product.id, product]));
const productSource = readFileSync(new URL("../../src/pages/commerce/product.js", import.meta.url), "utf8")
  .replace(/^import\s+.*?;\s*$/gm, "");

class MemoryStorage {
  constructor({ denyWrites = false } = {}) {
    this.values = new Map();
    this.denyWrites = denyWrites;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (this.denyWrites) throw new DOMException("Storage write denied", "QuotaExceededError");
    this.values.set(key, String(value));
  }
}

class FakeElement {
  constructor({ dataset = {}, value = "" } = {}) {
    this.dataset = { ...dataset };
    this.value = value;
    this.disabled = false;
    this.textContent = "";
    this.listeners = new Map();
    this.children = [];
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type) {
    const event = {
      type,
      target: this,
      currentTarget: this,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
    };
    (this.listeners.get(type) || []).forEach((listener) => listener(event));
    return event;
  }

  querySelector(selector) {
    if (selector === "[data-detail-add]") return this.children.find((child) => child.dataset.detailAdd !== undefined) || null;
    return null;
  }

  querySelectorAll(selector) {
    if (selector === "[data-detail-quantity]") {
      return this.children.filter((child) => child.dataset.detailQuantity !== undefined);
    }
    return [];
  }
}

class FakeDocument {
  constructor(productId, initialQuantity = "1") {
    this.detail = new FakeElement({ dataset: { productId } });
    this.form = new FakeElement();
    this.quantity = new FakeElement({ value: initialQuantity });
    this.status = new FakeElement();
    this.addButton = new FakeElement({ dataset: { detailAdd: "" } });
    this.decreaseButton = new FakeElement({ dataset: { detailQuantity: "-1" } });
    this.increaseButton = new FakeElement({ dataset: { detailQuantity: "1" } });
    this.form.children.push(this.addButton, this.decreaseButton, this.increaseButton);
  }

  querySelector(selector) {
    if (selector === ".store-detail-shell[data-product-id]") return this.detail;
    if (selector === "[data-detail-form]") return this.form;
    return null;
  }

  getElementById(id) {
    if (id === "detail-quantity") return this.quantity;
    if (id === "product-add-status") return this.status;
    return null;
  }
}

function mountProduct({ productId = "field-notebook", initialQuantity = "1", storage = new MemoryStorage(), addResult } = {}) {
  const document = new FakeDocument(productId, initialQuantity);
  const repository = {
    getById: (id) => productsById.get(id) || null,
  };
  let cart;
  const createCart = () => {
    cart = addResult
      ? { add: addResult }
      : createCartModel({ storage });
    return cart;
  };
  const execute = new Function(
    "document",
    "productRepository",
    "createCartModel",
    `${productSource}\nreturn { cart };`,
  );
  const runtime = execute(document, repository, createCart);
  return { document, cart, runtime };
}

test("detail quantity controls clamp to 1–10 and submit adds that quantity with a success message", () => {
  const storage = new MemoryStorage();
  const app = mountProduct({ initialQuantity: "99", storage });

  app.document.quantity.dispatch("change");
  assert.equal(app.document.quantity.value, "10", "change clamps values above the allowed maximum");
  app.document.increaseButton.dispatch("click");
  assert.equal(app.document.quantity.value, "10", "increment cannot exceed the maximum");
  app.document.quantity.value = "0";
  app.document.decreaseButton.dispatch("click");
  assert.equal(app.document.quantity.value, "1", "decrement cannot go below one");
  app.document.quantity.value = "8";
  const submit = app.document.form.dispatch("submit");

  assert.equal(submit.defaultPrevented, true);
  assert.deepEqual(app.cart.getItems(), [
    { productId: "field-notebook", variantId: null, quantity: 8 },
  ]);
  assert.match(app.document.status.textContent, /^Field notebook added to your bag\.$/);
  assert.equal(JSON.parse(storage.getItem("theme:commerce-demo:cart:v1")).items[0].quantity, 8);
});

test("detail submit clamps the submitted value before adding it", () => {
  const app = mountProduct({ initialQuantity: "15" });
  app.document.form.dispatch("submit");

  assert.equal(app.document.quantity.value, "10");
  assert.equal(app.cart.getItems()[0].quantity, 10);
});

test("missing catalog product disables add and reports that it is unavailable", () => {
  const app = mountProduct({ productId: "missing-product" });
  const submit = app.document.form.dispatch("submit");

  assert.equal(app.document.addButton.disabled, true);
  assert.equal(app.document.status.textContent, "This product is no longer available in the catalog.");
  assert.equal(submit.defaultPrevented, false, "no submit handler is attached for a missing product");
  assert.deepEqual(app.cart.getItems(), []);
});

test("a rejected cart add reports the inline retry message", () => {
  let attemptedItem;
  const app = mountProduct({
    addResult(item) {
      attemptedItem = item;
      return { ok: false, reason: "invalid-item" };
    },
  });
  app.document.quantity.value = "3";
  app.document.form.dispatch("submit");

  assert.deepEqual(attemptedItem, { productId: "field-notebook", quantity: 3 });
  assert.equal(app.document.status.textContent, "This item could not be added. Please try again.");
});

test("storage denial keeps the add in memory and explains the visit-only bag", () => {
  const app = mountProduct({ storage: new MemoryStorage({ denyWrites: true }) });
  app.document.quantity.value = "2";
  app.document.form.dispatch("submit");

  assert.deepEqual(app.cart.getItems(), [
    { productId: "field-notebook", variantId: null, quantity: 2 },
  ]);
  assert.match(app.document.status.textContent, /^Field notebook added to your bag\./);
  assert.match(app.document.status.textContent, /available for this visit, but this browser could not save it\.$/);
});
