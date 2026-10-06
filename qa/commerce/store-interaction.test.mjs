import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createCartModel } from "./cart-model-loader.mjs";

const require = createRequire(import.meta.url);
const products = require("../../src/content/products/products.cjs");
const productById = new Map(products.map((product) => [product.id, product]));
const storeSource = readFileSync(
  new URL("../../src/views/commerce/store.js", import.meta.url),
  "utf8",
).replace(/^import\s+.*?;\s*$/gm, "");

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

class FakeElement {
  constructor(tagName = "div", { id = "", dataset = {}, value = "", href = "" } = {}) {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.dataset = { ...dataset };
    this.value = value;
    this.href = href;
    this.checked = false;
    this.hidden = false;
    this.open = false;
    this.disabled = false;
    this.attributes = new Map();
    this.listeners = new Map();
    this.children = [];
    this.parentElement = null;
    this._textContent = "";
    this._className = "";
    this.style = {
      width: "",
      setProperty() {},
    };
    this.classList = {
      add: (...names) => {
        const classes = new Set(this._className.split(/\s+/).filter(Boolean));
        names.forEach((name) => classes.add(name));
        this._className = [...classes].join(" ");
      },
      remove: (...names) => {
        const removed = new Set(names);
        this._className = this._className
          .split(/\s+/)
          .filter((name) => name && !removed.has(name))
          .join(" ");
      },
      contains: (name) => this._className.split(/\s+/).includes(name),
      toggle: (name, force) => {
        const next = force === undefined ? !this.classList.contains(name) : Boolean(force);
        if (next) this.classList.add(name);
        else this.classList.remove(name);
        return next;
      },
    };
    this.options = [];
  }

  get className() {
    return this._className;
  }

  set className(value) {
    this._className = String(value);
  }

  get textContent() {
    return this._textContent + this.children.map((child) => child.textContent).join("");
  }

  set textContent(value) {
    this.children.forEach((child) => {
      child.parentElement = null;
    });
    this.children = [];
    this._textContent = String(value ?? "");
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type, properties = {}) {
    const event = {
      type,
      target: this,
      currentTarget: this,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...properties,
    };
    (this.listeners.get(type) || []).forEach((listener) => listener(event));
    return event;
  }

  append(...children) {
    children.forEach((child) => {
      if (!(child instanceof FakeElement)) return;
      child.parentElement?.removeChild(child);
      child.parentElement = this;
      this.children.push(child);
    });
  }

  removeChild(child) {
    this.children = this.children.filter((entry) => entry !== child);
    child.parentElement = null;
  }

  replaceChildren(...children) {
    this.children.forEach((child) => {
      child.parentElement = null;
    });
    this.children = [];
    this._textContent = "";
    this.append(...children);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  querySelector(selector) {
    if (selector === "span") return this.children.find((child) => child.tagName === "SPAN") || null;
    if (selector === "input[type=email]") return null;
    if (selector === ".store-newsletter__status") return null;
    return null;
  }

  querySelectorAll() {
    return [];
  }

  closest(selector) {
    if (selector === "[data-add-product]" && this.dataset.addProduct) return this;
    if (selector === "[data-quick-view]" && this.dataset.quickView) return this;
    if (selector === "[data-cart-action]" && this.dataset.cartAction) return this;
    return null;
  }

  contains(element) {
    return (
      this.children.includes(element) || this.children.some((child) => child.contains(element))
    );
  }

  showModal() {
    this.open = true;
  }

  close() {
    this.open = false;
  }

  focus() {}

  checkValidity() {
    return true;
  }
}

class FakeWindow {
  constructor(pathname, storage) {
    this.localStorage = storage;
    this.currentUrl = new URL(pathname, "http://commerce.test").href;
    this.listeners = new Map();
    this.pendingTimers = new Map();
    this.nextTimerId = 1;
    this.historyEntries = [{ url: this.currentUrl, state: null }];
    this.historyIndex = 0;
    this.location = {};
    ["href", "pathname", "search", "hash"].forEach((key) => {
      Object.defineProperty(this.location, key, {
        get: () => new URL(this.currentUrl)[key],
      });
    });
    this.history = {
      pushState: (state, _title, url) => {
        const nextUrl = new URL(url, this.currentUrl).href;
        this.historyEntries = this.historyEntries.slice(0, this.historyIndex + 1);
        this.historyEntries.push({ url: nextUrl, state });
        this.historyIndex += 1;
        this.currentUrl = nextUrl;
      },
      back: () => this.moveHistory(-1),
      forward: () => this.moveHistory(1),
    };
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  moveHistory(direction) {
    const nextIndex = this.historyIndex + direction;
    if (nextIndex < 0 || nextIndex >= this.historyEntries.length) return;
    this.historyIndex = nextIndex;
    const entry = this.historyEntries[nextIndex];
    this.currentUrl = entry.url;
    (this.listeners.get("popstate") || []).forEach((listener) => listener({ state: entry.state }));
  }

  setTimeout(callback, delay = 0) {
    const id = this.nextTimerId++;
    this.pendingTimers.set(id, { callback, delay });
    return id;
  }

  clearTimeout(id) {
    this.pendingTimers.delete(id);
  }

  runTimers(upToDelay = Infinity) {
    const ready = [...this.pendingTimers.entries()].filter(([, timer]) => timer.delay <= upToDelay);
    ready.forEach(([id, timer]) => {
      this.pendingTimers.delete(id);
      timer.callback();
    });
  }
}

class FakeDocument {
  constructor(pathname) {
    this.elements = new Map();
    this.productGrid = this.add("store-product-grid");
    const pageNumber = pathname === "/commerce/catalog/" ? 2 : 1;
    const pageRecords = products.slice((pageNumber - 1) * 5, pageNumber * 5);
    this.productCards = pageRecords.map((product) => {
      const card = new FakeElement("article", { dataset: { productId: product.id } });
      this.productGrid.append(card);
      return card;
    });
    this.addButtons = new Map(
      pageRecords.map((product) => {
        const button = new FakeElement("button", { dataset: { addProduct: product.id } });
        button.append(new FakeElement("span"));
        return [product.id, button];
      }),
    );

    this.elements.set("store-search-input", this.add("store-search-input"));
    this.elements.get("store-search-input").value = "";
    this.elements.set("store-sort", this.add("store-sort"));
    this.elements.get("store-sort").value = "featured";
    this.elements.get("store-sort").options = ["featured", "newest", "price-low", "price-high"].map(
      (value) => ({ value }),
    );
    this.elements.set("store-filter-form", this.add("store-filter-form"));
    this.elements.get("store-filter-form").reset = () => {
      this.categoryFilters.forEach((input) => {
        input.checked = false;
      });
      this.colorFilters.forEach((input) => {
        input.checked = false;
      });
      this.stockFilter.checked = false;
    };
    this.categoryFilters = ["home", "desk", "living", "travel"].map(
      (value) => new FakeElement("input", { dataset: { filterCategory: "" }, value }),
    );
    this.colorFilters = ["sky", "clay", "sage", "ink"].map(
      (value) => new FakeElement("input", { dataset: { filterColor: "" }, value }),
    );
    this.stockFilter = new FakeElement("input", { dataset: { filterStock: "" }, value: "ready" });
    this.priceRange = new FakeElement("input", { dataset: { filterPrice: "" }, value: "160" });
    this.priceRange.min = "25";
    this.priceRange.max = "160";
    this.priceOutput = this.add("store-price-range-output");
    this.resultsCount = this.add("store-results-count");
    this.emptyState = this.add("store-empty-state");
    this.activeFiltersButton = new FakeElement("button");
    this.filterPanel = this.add("store-filter-panel");
    this.filterToggle = new FakeElement("button");
    this.categoryChips = ["all", "home", "desk", "living", "travel"].map(
      (value) => new FakeElement("button", { dataset: { categoryChip: value } }),
    );
    this.paginationLinks = ["/commerce/", "/commerce/catalog/"].map(
      (route) =>
        new FakeElement("a", {
          dataset: { catalogPageLink: "" },
          href: new URL(route, "http://commerce.test").href,
        }),
    );
    this.quickViewDialog = this.add("quick-view-dialog");
    [
      "quick-view-art",
      "quick-view-category",
      "quick-view-title",
      "quick-view-description",
      "quick-view-rating",
      "quick-view-reviews",
      "quick-view-price",
      "quick-view-compare",
      "quick-view-availability",
      "quick-view-quantity",
      "quick-view-add",
    ].forEach((id) => this.add(id));
    this.cartDialog = this.add("store-cart");
    [
      "store-cart-items",
      "store-cart-empty",
      "store-cart-footer",
      "store-cart-announcement",
      "store-cart-subtotal",
      "store-shipping-copy",
      "store-shipping-progress",
      "store-toast",
    ].forEach((id) => this.add(id));
    this.elements.get("store-shipping-progress").parentElement = new FakeElement("div");
    this.cartTrigger = new FakeElement("button", { dataset: { openCart: "" } });
    this.cartCount = new FakeElement("span", { dataset: { cartCount: "" } });
    this.cartCount.className = "store-cart-trigger__count";
    this.resetButtons = [
      new FakeElement("button", { dataset: { resetFilters: "" } }),
      new FakeElement("button", { dataset: { resetFilters: "" } }),
    ];
    this.demoCheckout = new FakeElement("button", { dataset: { demoCheckout: "" } });
    this.links = this.paginationLinks;
  }

  add(id) {
    const element = new FakeElement("div", { id });
    this.elements.set(id, element);
    return element;
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }

  querySelector(selector) {
    const selectors = new Map([
      ["[data-store-search]", this.elements.get("store-search-input")],
      ["[data-store-sort]", this.elements.get("store-sort")],
      ["#store-filter-form", this.elements.get("store-filter-form")],
      ["[data-filter-stock]", this.stockFilter],
      ["[data-filter-price]", this.priceRange],
      [".store-active-filters", this.activeFiltersButton],
      ["#store-filter-panel", this.filterPanel],
      ["[data-filter-toggle]", this.filterToggle],
      ["[data-demo-checkout]", this.demoCheckout],
      ["[data-newsletter-form]", null],
    ]);
    return selectors.get(selector) || null;
  }

  querySelectorAll(selector) {
    const selectors = new Map([
      [".store-product[data-product-id]", this.productCards],
      ["[data-category-chip]", this.categoryChips],
      ["[data-filter-category]", this.categoryFilters],
      ["[data-filter-color]", this.colorFilters],
      ["[data-quick-view]", []],
      ["[data-catalog-page-link]", this.paginationLinks],
      ["[data-reset-filters]", this.resetButtons],
      ["[data-open-cart]", [this.cartTrigger]],
      ["[data-quick-view-adjust]", []],
      ["[data-category-jump]", []],
      ["[data-cart-count]", [this.cartCount]],
    ]);
    return selectors.get(selector) || [];
  }
}

function formatMinorPrice(amountMinor, currency) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountMinor / 100);
}

function mountStore(pathname, storage) {
  const window = new FakeWindow(pathname, storage);
  const document = new FakeDocument(pathname);
  const repository = {
    getAll: () => products,
    getById: (id) => productById.get(id) || null,
  };
  const modelFactory = () => createCartModel({ storage });
  const execute = new Function(
    "document",
    "window",
    "productRepository",
    "formatMinorPrice",
    "createCartModel",
    `${storeSource}\nreturn { cart, filterProducts, restoreFiltersFromUrl };`,
  );
  const runtime = execute(document, window, repository, formatMinorPrice, modelFactory);
  return { document, window, runtime };
}

test("filter URL state restores on history back and forward", () => {
  const app = mountStore("/commerce/", new MemoryStorage());
  const search = app.document.getElementById("store-search-input");
  const category = app.document.categoryFilters.find((input) => input.value === "home");
  const color = app.document.colorFilters.find((input) => input.value === "sky");
  const sort = app.document.getElementById("store-sort");

  search.value = "field";
  search.dispatch("input");
  app.window.runTimers(300);
  assert.equal(app.window.location.search, "?q=field");

  category.checked = true;
  color.checked = true;
  app.document.stockFilter.checked = true;
  app.document.priceRange.value = "50";
  app.document.getElementById("store-filter-form").dispatch("change");
  assert.equal(
    app.window.location.search,
    "?q=field&category=home&color=sky&stock=ready&maxPrice=50",
  );
  assert.equal(
    app.document.getElementById("store-results-count").textContent,
    "0 pieces to discover",
  );
  assert.ok(
    app.document.paginationLinks.every(
      (link) => new URL(link.href, app.window.location.href).search === app.window.location.search,
    ),
  );

  sort.value = "price-low";
  sort.dispatch("change");
  assert.equal(
    app.window.location.search,
    "?q=field&category=home&color=sky&stock=ready&maxPrice=50&sort=price-low",
  );

  app.window.history.back();
  assert.equal(
    app.window.location.search,
    "?q=field&category=home&color=sky&stock=ready&maxPrice=50",
  );
  assert.equal(search.value, "field");
  assert.equal(category.checked, true);
  assert.equal(color.checked, true);
  assert.equal(app.document.stockFilter.checked, true);
  assert.equal(app.document.priceRange.value, "50");
  assert.equal(sort.value, "featured");

  app.window.history.forward();
  assert.equal(
    app.window.location.search,
    "?q=field&category=home&color=sky&stock=ready&maxPrice=50&sort=price-low",
  );
  assert.equal(sort.value, "price-low");
  assert.equal(
    app.document.getElementById("store-results-count").textContent,
    "0 pieces to discover",
  );

  app.window.history.back();
  app.window.history.back();
  assert.equal(app.window.location.search, "?q=field");
  assert.equal(category.checked, false);
  assert.equal(color.checked, false);
  assert.equal(app.document.stockFilter.checked, false);
  assert.equal(app.document.priceRange.value, "160");
  assert.equal(
    app.document.getElementById("store-results-count").textContent,
    "1 piece to discover",
  );
});

test("filter URL state restores after a page reload", () => {
  const app = mountStore(
    "/commerce/?q=field&category=home&color=sky&stock=ready&maxPrice=50&sort=price-low",
    new MemoryStorage(),
  );

  assert.equal(app.document.getElementById("store-search-input").value, "field");
  assert.equal(app.document.categoryFilters.find((input) => input.value === "home").checked, true);
  assert.equal(app.document.colorFilters.find((input) => input.value === "sky").checked, true);
  assert.equal(app.document.stockFilter.checked, true);
  assert.equal(app.document.priceRange.value, "50");
  assert.equal(app.document.getElementById("store-sort").value, "price-low");
  assert.equal(
    app.window.location.search,
    "?q=field&category=home&color=sky&stock=ready&maxPrice=50&sort=price-low",
  );
});

test("cart persists across catalog route navigation and a page reload", () => {
  const storage = new MemoryStorage();
  const firstPage = mountStore("/commerce/", storage);
  const addButton = firstPage.document.addButtons.get("field-notebook");
  assert.ok(addButton, "the first catalog page renders Field notebook");
  firstPage.document.productGrid.dispatch("click", { target: addButton });
  assert.equal(firstPage.runtime.cart.getSnapshot().count, 1);

  const secondPage = mountStore("/commerce/catalog/", storage);
  assert.equal(secondPage.document.cartCount.textContent, "1");
  secondPage.document.cartTrigger.dispatch("click");
  assert.equal(secondPage.document.cartDialog.open, true);
  assert.equal(secondPage.document.getElementById("store-cart-items").children.length, 1);
  assert.match(
    secondPage.document.getElementById("store-cart-items").textContent,
    /Field notebook/,
  );

  const reloadedSecondPage = mountStore("/commerce/catalog/", storage);
  reloadedSecondPage.document.cartTrigger.dispatch("click");
  assert.equal(reloadedSecondPage.runtime.cart.getSnapshot().count, 1);
  assert.match(
    reloadedSecondPage.document.getElementById("store-cart-items").textContent,
    /Field notebook/,
  );
});
