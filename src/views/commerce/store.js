import { productRepository, formatMinorPrice } from "@features/catalog/product-repository";
import { createCartModel } from "@features/cart/cart-model";

const FREE_SHIPPING_THRESHOLD_MINOR = 15000;
const FILTER_QUERY_KEYS = ["q", "category", "color", "stock", "maxPrice", "sort"];
const cart = createCartModel();
const allProducts = productRepository.getAll();
const productCards = new Map(
  Array.from(document.querySelectorAll(".store-product[data-product-id]"))
    .map((card) => [card.dataset.productId, card]),
);
const products = allProducts.filter((product) => productCards.has(product.id));
const productGrid = document.getElementById("store-product-grid");
const searchInput = document.querySelector("[data-store-search]");
const sortSelect = document.querySelector("[data-store-sort]");
const filterForm = document.getElementById("store-filter-form");
const categoryChips = Array.from(document.querySelectorAll("[data-category-chip]"));
const categoryFilters = Array.from(document.querySelectorAll("[data-filter-category]"));
const colorFilters = Array.from(document.querySelectorAll("[data-filter-color]"));
const stockFilter = document.querySelector("[data-filter-stock]");
const priceRange = document.querySelector("[data-filter-price]");
const priceOutput = document.getElementById("store-price-range-output");
const resultsCount = document.getElementById("store-results-count");
const emptyState = document.getElementById("store-empty-state");
const activeFiltersButton = document.querySelector(".store-active-filters");
const filterPanel = document.getElementById("store-filter-panel");
const filterToggle = document.querySelector("[data-filter-toggle]");

const quickViewDialog = document.getElementById("quick-view-dialog");
const quickViewArt = document.getElementById("quick-view-art");
const quickViewCategory = document.getElementById("quick-view-category");
const quickViewTitle = document.getElementById("quick-view-title");
const quickViewDescription = document.getElementById("quick-view-description");
const quickViewRating = document.getElementById("quick-view-rating");
const quickViewReviews = document.getElementById("quick-view-reviews");
const quickViewPrice = document.getElementById("quick-view-price");
const quickViewCompare = document.getElementById("quick-view-compare");
const quickViewAvailability = document.getElementById("quick-view-availability");
const quickViewQuantity = document.getElementById("quick-view-quantity");
const quickViewAdd = document.getElementById("quick-view-add");

const cartDialog = document.getElementById("store-cart");
const cartItems = document.getElementById("store-cart-items");
const cartEmpty = document.getElementById("store-cart-empty");
const cartFooter = document.getElementById("store-cart-footer");
const cartAnnouncement = document.getElementById("store-cart-announcement");
const cartSubtotal = document.getElementById("store-cart-subtotal");
const shippingCopy = document.getElementById("store-shipping-copy");
const shippingProgress = document.getElementById("store-shipping-progress");
const shippingProgressBar = shippingProgress?.parentElement;
const cartCountElements = Array.from(document.querySelectorAll("[data-cart-count]"));
const toast = document.getElementById("store-toast");

let quickViewProductId = null;
let toastTimeout;
let queryUpdateTimeout = null;

function formatPrice(product, quantity = 1) {
  return formatMinorPrice(product.priceMinor * quantity, product.currency);
}

function getCheckedValues(elements) {
  return elements.filter((element) => element.checked).map((element) => element.value);
}

function createProductArt(product, extraClass = "") {
  const art = document.createElement("div");
  art.className = `store-product__art ${extraClass} store-product__art--${product.art}`.trim();
  art.setAttribute("aria-hidden", "true");
  art.style.setProperty("--product-tone", product.tone);
  art.style.setProperty("--product-shadow", product.shadow);

  const shadow = document.createElement("span");
  shadow.className = "store-product__art-shadow";
  const object = document.createElement("span");
  object.className = "store-product__art-object";
  art.append(shadow, object);
  return art;
}

function createTextElement(tagName, className, value) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = value;
  return element;
}

function createCartLine(item) {
  const product = productRepository.getById(item.productId);
  const line = document.createElement("article");
  line.className = "store-cart-item";

  const artWrap = document.createElement("div");
  artWrap.className = "store-cart-item__art";
  if (product) {
    artWrap.append(createProductArt(product));
  } else {
    const unavailableArt = document.createElement("div");
    unavailableArt.className = "store-product__art store-cart-item__art--unavailable";
    unavailableArt.setAttribute("aria-hidden", "true");
    unavailableArt.textContent = "?";
    artWrap.append(unavailableArt);
  }

  const body = document.createElement("div");
  body.className = "store-cart-item__body";
  body.append(createTextElement("h3", "", product?.name || "Saved item unavailable"));
  body.append(createTextElement("p", "", product?.category || `Saved item ${item.productId} is no longer in the catalog.`));

  const quantity = document.createElement("div");
  quantity.className = "store-cart-item__quantity";
  quantity.setAttribute("aria-label", `Quantity for ${product?.name || "saved item"}`);
  const decrease = document.createElement("button");
  decrease.type = "button";
  decrease.dataset.cartAction = "decrease";
  decrease.dataset.cartId = item.productId;
  decrease.setAttribute("aria-label", `Decrease ${product?.name || "saved item"} quantity`);
  decrease.textContent = "−";
  const quantityLabel = document.createElement("span");
  quantityLabel.setAttribute("aria-label", `${item.quantity} selected`);
  quantityLabel.textContent = String(item.quantity);
  const increase = document.createElement("button");
  increase.type = "button";
  increase.dataset.cartAction = "increase";
  increase.dataset.cartId = item.productId;
  increase.setAttribute("aria-label", `Increase ${product?.name || "saved item"} quantity`);
  increase.textContent = "+";
  if (item.variantId) {
    decrease.dataset.variantId = item.variantId;
    increase.dataset.variantId = item.variantId;
  }
  quantity.append(decrease, quantityLabel, increase);
  body.append(quantity);

  const aside = document.createElement("div");
  aside.className = "store-cart-item__aside";
  if (product) aside.append(createTextElement("strong", "", formatPrice(product, item.quantity)));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.dataset.cartAction = "remove";
  remove.dataset.cartId = item.productId;
  if (item.variantId) remove.dataset.variantId = item.variantId;
  remove.setAttribute("aria-label", `Remove ${product?.name || "saved item"} from your bag`);
  remove.textContent = "Remove";
  aside.append(remove);

  line.append(artWrap, body, aside);
  return line;
}

function updateShippingMessage(subtotalMinor) {
  const amountRemainingMinor = Math.max(FREE_SHIPPING_THRESHOLD_MINOR - subtotalMinor, 0);
  const progress = Math.min((subtotalMinor / FREE_SHIPPING_THRESHOLD_MINOR) * 100, 100);
  shippingCopy.textContent = amountRemainingMinor > 0
    ? `You are ${formatMinorPrice(amountRemainingMinor, "USD")} away from complimentary shipping.`
    : "You unlocked complimentary shipping — it is on us.";
  shippingProgress.style.width = `${progress}%`;
  shippingProgressBar?.setAttribute("aria-valuenow", String(Math.min(subtotalMinor / 100, 150)));
}

function setCartCount(count) {
  cartCountElements.forEach((element) => {
    element.textContent = String(count);
    if (element.classList.contains("store-cart-trigger__count")) {
      element.setAttribute("aria-label", `${count} ${count === 1 ? "item" : "items"} in bag`);
    }
  });
}

function renderCart() {
  const items = cart.getItems();
  const subtotals = new Map();
  items.forEach((item) => {
    const product = productRepository.getById(item.productId);
    if (!product) return;
    subtotals.set(product.currency, (subtotals.get(product.currency) || 0) + product.priceMinor * item.quantity);
  });

  const usdSubtotalMinor = subtotals.get("USD") || 0;
  const subtotalLabel = subtotals.size
    ? [...subtotals].map(([currency, amount]) => formatMinorPrice(amount, currency)).join(" · ")
    : formatMinorPrice(0, "USD");
  cartItems.replaceChildren(...items.map(createCartLine));
  cartItems.hidden = items.length === 0;
  cartEmpty.hidden = items.length > 0;
  cartFooter.hidden = items.length === 0;
  cartSubtotal.textContent = subtotalLabel;
  updateShippingMessage(usdSubtotalMinor);
  setCartCount(cart.getSnapshot().count);
}

function announceCart(message) {
  cartAnnouncement.textContent = message;
}

function getStorageMessage(issue) {
  if (issue === "invalid-data") return "A saved bag could not be read. Your current bag will be kept for this visit.";
  if (issue === "read-failed") return "This browser could not read the saved bag. Your current bag will be kept for this visit.";
  return "This browser could not save the bag. It will stay available for this visit.";
}

function getLoadWarning(issue) {
  if (issue === "invalid-data") return "An earlier saved bag could not be read; this bag starts without those items.";
  if (issue === "read-failed") return "An earlier saved bag could not be read and may not be included.";
  return "The previous bag was unavailable; this bag starts empty.";
}

function getCartStorageNotice(state) {
  if (!state.persisted) return getStorageMessage(state.storageIssue);
  if (state.loadIssue) return getLoadWarning(state.loadIssue);
  return "";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 3000);
}

function addToCart(productId, quantity = 1) {
  const product = productRepository.getById(productId);
  if (!product) {
    announceCart("This product is no longer available. Your saved bag was kept.");
    return false;
  }

  const result = cart.add({ productId, quantity });
  if (!result.ok) {
    announceCart("This item could not be added. Please try again.");
    return false;
  }
  const storageNotice = getCartStorageNotice(result);
  announceCart(storageNotice
    ? `${product.name} added to your bag. ${storageNotice}`
    : `${product.name} added to your bag.`);
  showToast(storageNotice
    ? `${product.name} is in your bag for this visit.`
    : `${product.name} is in your bag.`);
  return true;
}

function changeCartQuantity(productId, variantId, action) {
  const item = cart.getItems().find((entry) => (
    entry.productId === productId && entry.variantId === (variantId || null)
  ));
  if (!item) {
    announceCart("That saved item could not be found. The rest of your bag is unchanged.");
    return;
  }

  const product = productRepository.getById(productId);
  const label = product?.name || "Saved item";
  if (action === "remove") {
    const result = cart.remove({ productId, variantId });
    const storageNotice = getCartStorageNotice(result);
    announceCart(storageNotice
      ? `${label} removed from your bag. ${storageNotice}`
      : `${label} removed from your bag.`);
    return;
  }

  const change = action === "increase" ? 1 : -1;
  const result = cart.setQuantity({ productId, variantId, quantity: item.quantity + change });
  const storageNotice = getCartStorageNotice(result);
  announceCart(storageNotice
    ? `${label} quantity updated. ${storageNotice}`
    : `${label} quantity updated.`);
}

function syncCategoryChips() {
  const selectedCategories = getCheckedValues(categoryFilters);
  const selectedCategory = selectedCategories.length === 1 ? selectedCategories[0] : "all";
  categoryChips.forEach((chip) => {
    const isSelected = chip.dataset.categoryChip === selectedCategory;
    chip.classList.toggle("is-selected", isSelected);
    chip.setAttribute("aria-pressed", String(isSelected));
  });
}

function restoreFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const validCategories = new Set(categoryFilters.map((input) => input.value));
  const validColors = new Set(colorFilters.map((input) => input.value));
  const selectedCategories = new Set(params.getAll("category").filter((value) => validCategories.has(value)));
  const selectedColors = new Set(params.getAll("color").filter((value) => validColors.has(value)));

  searchInput.value = params.get("q") || "";
  categoryFilters.forEach((input) => { input.checked = selectedCategories.has(input.value); });
  colorFilters.forEach((input) => { input.checked = selectedColors.has(input.value); });
  stockFilter.checked = params.get("stock") === "ready";

  const maxPrice = Number(params.get("maxPrice"));
  const minRangePrice = Number(priceRange.min);
  const maxRangePrice = Number(priceRange.max);
  priceRange.value = params.has("maxPrice") && Number.isFinite(maxPrice)
    ? String(Math.min(maxRangePrice, Math.max(minRangePrice, maxPrice)))
    : priceRange.max;

  const validSorts = new Set(Array.from(sortSelect.options, (option) => option.value));
  const sort = params.get("sort");
  sortSelect.value = validSorts.has(sort) ? sort : "featured";
  syncCategoryChips();
  setPriceOutput();
}

function getFilterStateUrl() {
  const params = new URLSearchParams(window.location.search);
  FILTER_QUERY_KEYS.forEach((key) => params.delete(key));

  const query = searchInput.value.trim();
  if (query) params.set("q", query);
  getCheckedValues(categoryFilters).forEach((value) => params.append("category", value));
  getCheckedValues(colorFilters).forEach((value) => params.append("color", value));
  if (stockFilter.checked) params.set("stock", "ready");
  if (Number(priceRange.value) < Number(priceRange.max)) params.set("maxPrice", priceRange.value);
  if (sortSelect.value !== "featured") params.set("sort", sortSelect.value);

  const queryString = params.toString();
  return `${window.location.pathname}${queryString ? `?${queryString}` : ""}${window.location.hash}`;
}

function syncPaginationQuery() {
  document.querySelectorAll("[data-catalog-page-link]").forEach((link) => {
    const target = new URL(link.href, window.location.href);
    target.search = window.location.search;
    link.href = `${target.pathname}${target.search}${target.hash}`;
  });
}

function pushFilterState() {
  window.clearTimeout(queryUpdateTimeout);
  queryUpdateTimeout = null;
  const nextUrl = getFilterStateUrl();
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) window.history.pushState({ commerceFilters: true }, "", nextUrl);
  syncPaginationQuery();
}

function scheduleFilterStatePush() {
  window.clearTimeout(queryUpdateTimeout);
  queryUpdateTimeout = window.setTimeout(pushFilterState, 300);
}

function hasActiveFilters() {
  return Boolean(
    searchInput.value.trim()
    || getCheckedValues(categoryFilters).length
    || getCheckedValues(colorFilters).length
    || stockFilter.checked
    || Number(priceRange.value) < Number(priceRange.max)
    || sortSelect.value !== "featured",
  );
}

function sortProducts(filteredProducts) {
  const sorted = [...filteredProducts];
  switch (sortSelect.value) {
    case "newest":
      return sorted.sort((a, b) => Number(b.isNew) - Number(a.isNew) || a.rank - b.rank);
    case "price-low":
      return sorted.sort((a, b) => a.priceMinor - b.priceMinor || a.rank - b.rank);
    case "price-high":
      return sorted.sort((a, b) => b.priceMinor - a.priceMinor || a.rank - b.rank);
    default:
      return sorted.sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
  }
}

function filterProducts() {
  const query = searchInput.value.trim().toLocaleLowerCase("en-US");
  const selectedCategories = getCheckedValues(categoryFilters);
  const selectedColors = getCheckedValues(colorFilters);
  const selectedPriceMinor = Number(priceRange.value) * 100;
  const readyOnly = stockFilter.checked;

  const visibleProducts = products.filter((product) => {
    const searchText = `${product.name} ${product.description} ${product.category} ${product.tags}`.toLocaleLowerCase("en-US");
    return (!query || searchText.includes(query))
      && (!selectedCategories.length || selectedCategories.includes(product.category))
      && (!selectedColors.length || selectedColors.includes(product.color))
      && product.priceMinor <= selectedPriceMinor
      && (!readyOnly || product.stock === "ready");
  });

  const visibleIds = new Set(visibleProducts.map((product) => product.id));
  products.forEach((product) => {
    const card = productCards.get(product.id);
    if (card) card.hidden = !visibleIds.has(product.id);
  });
  sortProducts(visibleProducts).forEach((product) => {
    const card = productCards.get(product.id);
    if (card) productGrid.append(card);
  });

  const count = visibleProducts.length;
  resultsCount.textContent = count === 1 ? "1 piece to discover" : `${count} pieces to discover`;
  emptyState.hidden = count !== 0;
  productGrid.hidden = count === 0;
  activeFiltersButton.hidden = !hasActiveFilters();
}

function resetFilters() {
  filterForm.reset();
  searchInput.value = "";
  sortSelect.value = "featured";
  priceRange.value = priceRange.max;
  priceOutput.textContent = `${formatMinorPrice(Number(priceRange.value) * 100, "USD")}+`;
  syncCategoryChips();
  filterProducts();
  pushFilterState();
}

function setPriceOutput() {
  priceOutput.textContent = `${formatMinorPrice(Number(priceRange.value) * 100, "USD")}+`;
}

function openQuickView(productId) {
  const product = productRepository.getById(productId);
  if (!product) {
    announceCart("This product is no longer available in the catalog.");
    return;
  }

  quickViewProductId = product.id;
  quickViewArt.className = `store-product__art store-product__art--${product.art}`;
  quickViewArt.style.setProperty("--product-tone", product.tone);
  quickViewArt.style.setProperty("--product-shadow", product.shadow);
  quickViewCategory.textContent = product.category;
  quickViewTitle.textContent = product.name;
  quickViewDescription.textContent = product.description;
  quickViewRating.textContent = product.rating;
  quickViewReviews.textContent = `(${product.reviews} reviews)`;
  quickViewPrice.textContent = formatPrice(product);
  quickViewCompare.textContent = product.compareAtPriceMinor ? formatMinorPrice(product.compareAtPriceMinor, product.currency) : "";
  quickViewCompare.hidden = !product.compareAtPriceMinor;
  quickViewAvailability.textContent = product.stock === "limited" ? "Only a few left in the studio" : "Ready to dispatch today";
  quickViewQuantity.value = 1;
  quickViewAdd.textContent = `Add to bag · ${formatPrice(product)}`;

  if (!quickViewDialog.open) quickViewDialog.showModal();
}

function updateQuickViewQuantity(change) {
  const oldValue = Number(quickViewQuantity.value) || 1;
  quickViewQuantity.value = Math.min(10, Math.max(1, oldValue + change));
}

productGrid.addEventListener("click", (event) => {
  const quickViewButton = event.target.closest("[data-quick-view]");
  const addButton = event.target.closest("[data-add-product]");

  if (quickViewButton) {
    openQuickView(quickViewButton.dataset.quickView);
    return;
  }

  if (addButton && addToCart(addButton.dataset.addProduct)) {
    addButton.classList.add("is-added");
    const label = addButton.querySelector("span");
    if (label) label.textContent = "Added";
    window.setTimeout(() => {
      addButton.classList.remove("is-added");
      if (label) label.textContent = "Add";
    }, 1500);
  }
});

document.querySelectorAll("[data-quick-view]").forEach((button) => {
  if (productGrid.contains(button)) return;
  button.addEventListener("click", () => openQuickView(button.dataset.quickView));
});

categoryChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const category = chip.dataset.categoryChip;
    categoryFilters.forEach((filter) => {
      filter.checked = category !== "all" && filter.value === category;
    });
    syncCategoryChips();
    filterProducts();
    pushFilterState();
  });
});

document.querySelectorAll("[data-category-jump]").forEach((button) => {
  button.addEventListener("click", () => {
    const category = button.dataset.categoryJump;
    categoryFilters.forEach((filter) => {
      filter.checked = filter.value === category;
    });
    syncCategoryChips();
    filterProducts();
    pushFilterState();
    document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

searchInput.addEventListener("input", () => {
  filterProducts();
  scheduleFilterStatePush();
});
searchInput.addEventListener("change", pushFilterState);
sortSelect.addEventListener("change", () => {
  filterProducts();
  pushFilterState();
});
filterForm.addEventListener("change", () => {
  syncCategoryChips();
  filterProducts();
  pushFilterState();
});
priceRange.addEventListener("input", () => {
  setPriceOutput();
  filterProducts();
  scheduleFilterStatePush();
});
priceRange.addEventListener("change", pushFilterState);
document.querySelectorAll("[data-reset-filters]").forEach((button) => button.addEventListener("click", resetFilters));

filterToggle?.addEventListener("click", () => {
  const isOpen = filterPanel.classList.toggle("is-open");
  filterToggle.setAttribute("aria-expanded", String(isOpen));
});

document.querySelectorAll("[data-open-cart]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!cartDialog.open) cartDialog.showModal();
    const storageNotice = getCartStorageNotice(cart.getSnapshot());
    if (storageNotice) announceCart(storageNotice);
  });
});

quickViewDialog.addEventListener("click", (event) => {
  if (event.target === quickViewDialog) quickViewDialog.close();
});
cartDialog.addEventListener("click", (event) => {
  if (event.target === cartDialog) cartDialog.close();
});

document.querySelectorAll("[data-quick-view-adjust]").forEach((button) => {
  button.addEventListener("click", () => updateQuickViewQuantity(Number(button.dataset.quickViewAdjust)));
});

quickViewQuantity.addEventListener("change", () => {
  const validQuantity = Math.min(10, Math.max(1, Number(quickViewQuantity.value) || 1));
  quickViewQuantity.value = validQuantity;
});

quickViewAdd.addEventListener("click", () => {
  if (!quickViewProductId) {
    announceCart("Choose a product before adding it to your bag.");
    return;
  }
  if (addToCart(quickViewProductId, Number(quickViewQuantity.value) || 1)) {
    quickViewDialog.close();
    if (!cartDialog.open) cartDialog.showModal();
  }
});

cartItems.addEventListener("click", (event) => {
  const button = event.target.closest("[data-cart-action]");
  if (!button) return;
  changeCartQuantity(button.dataset.cartId, button.dataset.variantId || null, button.dataset.cartAction);
});

document.querySelector("[data-demo-checkout]")?.addEventListener("click", () => {
  showToast("This storefront demo does not submit an order or payment; checkout is not connected.");
});

document.querySelector("[data-newsletter-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector(".store-newsletter__status");
  const email = form.querySelector("input[type=email]");
  if (!email.checkValidity()) {
    status.textContent = "Enter a valid email address to continue.";
    email.focus();
    return;
  }
  status.textContent = "This storefront demo does not submit newsletter subscriptions yet.";
  form.reset();
});

cart.subscribe(() => renderCart());
restoreFiltersFromUrl();
filterProducts();
renderCart();
syncPaginationQuery();
window.addEventListener("popstate", () => {
  window.clearTimeout(queryUpdateTimeout);
  queryUpdateTimeout = null;
  restoreFiltersFromUrl();
  filterProducts();
  syncPaginationQuery();
});
