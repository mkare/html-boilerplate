import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CART_STORAGE_KEY,
  LEGACY_CART_STORAGE_KEY,
  createCartModel,
} from "./cart-model-loader.mjs";

class MemoryStorage {
  constructor(entries = []) {
    this.values = new Map(entries);
    this.denyReads = false;
    this.denyWrites = false;
  }

  getItem(key) {
    if (this.denyReads) throw new DOMException("Storage read denied", "SecurityError");
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (this.denyWrites) throw new DOMException("Storage write denied", "QuotaExceededError");
    this.values.set(key, String(value));
  }

  removeItem(key) {
    if (this.denyWrites) throw new DOMException("Storage write denied", "SecurityError");
    this.values.delete(key);
  }
}

test("migrates atelier-store-cart-v1 into the versioned cart key", () => {
  const storage = new MemoryStorage([[
    LEGACY_CART_STORAGE_KEY,
    JSON.stringify([
      { id: "field-notebook", quantity: 2 },
      { id: "retired-product", quantity: 1, variantId: "linen" },
    ]),
  ]]);

  const cart = createCartModel({ storage });

  assert.deepEqual(cart.getItems(), [
    { productId: "field-notebook", variantId: null, quantity: 2 },
    { productId: "retired-product", variantId: "linen", quantity: 1 },
  ]);
  assert.deepEqual(JSON.parse(storage.getItem(CART_STORAGE_KEY)), {
    version: 1,
    items: cart.getItems(),
  });
  assert.equal(storage.getItem(LEGACY_CART_STORAGE_KEY), null);
  assert.equal(cart.getSnapshot().persisted, true);
});

test("keeps unknown catalog IDs when loading, adding, and reloading a cart", () => {
  const storage = new MemoryStorage([[
    CART_STORAGE_KEY,
    JSON.stringify({ version: 1, items: [{ productId: "retired-product", quantity: 3 }] }),
  ]]);
  const cart = createCartModel({ storage });

  assert.equal(cart.getItems()[0].productId, "retired-product");
  assert.equal(cart.add({ productId: "field-notebook" }).ok, true);
  assert.deepEqual(createCartModel({ storage }).getItems(), [
    { productId: "retired-product", variantId: null, quantity: 3 },
    { productId: "field-notebook", variantId: null, quantity: 1 },
  ]);
});

test("reports denied storage reads and keeps later cart changes in memory", () => {
  const storage = new MemoryStorage();
  storage.denyReads = true;
  const cart = createCartModel({ storage });

  assert.equal(cart.getSnapshot().loadIssue, "read-failed");
  const result = cart.add({ productId: "field-notebook", quantity: 2 });
  assert.equal(result.ok, true);
  assert.equal(result.persisted, true);
  assert.equal(result.loadIssue, "read-failed");
  assert.deepEqual(cart.getItems(), [
    { productId: "field-notebook", variantId: null, quantity: 2 },
  ]);
});

test("reports denied storage writes and keeps cart changes in memory", () => {
  const storage = new MemoryStorage();
  storage.denyWrites = true;
  const cart = createCartModel({ storage });

  const result = cart.add({ productId: "field-notebook", quantity: 2 });
  assert.equal(result.ok, true);
  assert.equal(result.persisted, false);
  assert.equal(result.storageIssue, "write-failed");
  assert.deepEqual(cart.getItems(), [
    { productId: "field-notebook", variantId: null, quantity: 2 },
  ]);
});

test("catalog lookup failure does not clear saved or unknown cart lines", async () => {
  const storage = new MemoryStorage([[
    CART_STORAGE_KEY,
    JSON.stringify({ version: 1, items: [
      { productId: "field-notebook", variantId: null, quantity: 1 },
      { productId: "retired-product", variantId: null, quantity: 2 },
    ] }),
  ]]);
  const cart = createCartModel({ storage });
  const before = cart.getItems();
  const failedCatalog = {
    async getByIds() {
      throw new Error("Catalog unavailable");
    },
  };

  await assert.rejects(failedCatalog.getByIds(before.map((item) => item.productId)), /Catalog unavailable/);
  assert.deepEqual(cart.getItems(), before);
  assert.deepEqual(JSON.parse(storage.getItem(CART_STORAGE_KEY)).items, before);
});
