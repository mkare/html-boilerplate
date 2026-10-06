export const CART_STORAGE_KEY = "theme:commerce-demo:cart:v1";
export const LEGACY_CART_STORAGE_KEY = "atelier-store-cart-v1";
const MAX_LINE_QUANTITY = 10;

const clampQuantity = (value) => {
  const quantity = Math.trunc(Number(value));
  if (!Number.isFinite(quantity) || quantity < 1) return null;
  return Math.min(MAX_LINE_QUANTITY, quantity);
};

const normalizeItem = (item, { legacy = false } = {}) => {
  if (!item || typeof item !== "object") return null;
  const productId = legacy ? item.id : item.productId ?? item.id;
  const quantity = clampQuantity(item.quantity);
  if (typeof productId !== "string" || productId.length === 0 || quantity === null) return null;

  const variantId = typeof item.variantId === "string" && item.variantId.length > 0
    ? item.variantId
    : null;
  return { productId, variantId, quantity };
};

const normalizeItems = (items, options) => {
  const lines = new Map();
  items.forEach((item) => {
    const normalized = normalizeItem(item, options);
    if (!normalized) return;

    const key = JSON.stringify([normalized.productId, normalized.variantId]);
    const current = lines.get(key);
    if (current) current.quantity = Math.min(MAX_LINE_QUANTITY, current.quantity + normalized.quantity);
    else lines.set(key, normalized);
  });
  return [...lines.values()];
};

const cloneItems = (items) => items.map((item) => ({ ...item }));
const lineIndex = (items, productId, variantId) => items.findIndex((item) => (
  item.productId === productId && item.variantId === (variantId || null)
));

/**
 * Create a DOM-independent cart state model. Storage can be injected for tests
 * or adapters; when browser storage is unavailable, mutations remain in memory.
 * Unknown product IDs are intentionally retained for later catalog recovery.
 *
 * @param {{ storage?: Storage | null }} [options]
 */
export function createCartModel(options = {}) {
  const hasStorageOption = Object.prototype.hasOwnProperty.call(options, "storage");
  let storage = null;
  let storageIssue = null;
  let loadIssue = null;
  let persisted = false;
  let items = [];
  const listeners = new Set();

  try {
    storage = hasStorageOption ? options.storage : globalThis.localStorage;
  } catch {
    storageIssue = "unavailable";
  }
  if (!storage) storageIssue ||= "unavailable";

  const snapshot = () => ({
    items: cloneItems(items),
    count: items.reduce((total, item) => total + item.quantity, 0),
    persisted,
    storageIssue,
    loadIssue,
  });

  const notify = (reason) => {
    const current = snapshot();
    listeners.forEach((listener) => {
      try {
        listener(current, reason);
      } catch {
        // A subscriber cannot prevent other cart consumers from updating.
      }
    });
  };

  const write = () => {
    if (!storage) {
      persisted = false;
      storageIssue ||= "unavailable";
      return false;
    }
    try {
      storage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 1, items }));
      persisted = true;
      storageIssue = null;
      return true;
    } catch {
      persisted = false;
      storageIssue = "write-failed";
      return false;
    }
  };

  const read = (key) => {
    try {
      return { ok: true, value: storage.getItem(key) };
    } catch {
      return { ok: false, value: null };
    }
  };

  const currentRead = storage ? read(CART_STORAGE_KEY) : { ok: false, value: null };
  if (!storage) {
    persisted = false;
    storageIssue = "unavailable";
  } else if (!currentRead.ok) {
    persisted = false;
    storageIssue = "read-failed";
    loadIssue = "read-failed";
  } else if (currentRead.value !== null) {
    try {
      const parsed = JSON.parse(currentRead.value);
      if (parsed?.version === 1 && Array.isArray(parsed.items)) {
        items = normalizeItems(parsed.items);
        persisted = true;
      } else {
        storageIssue = "invalid-data";
        loadIssue = "invalid-data";
      }
    } catch {
      storageIssue = "invalid-data";
      loadIssue = "invalid-data";
    }
  }

  // Migrate the previous array format without discarding it unless the new
  // version was written successfully. The new key always takes precedence.
  // Keep this compatibility reader through the 1.x migration window; see
  // docs/migrations/upgrade-guide.md for its 2.0.0 removal floor.
  if (storage && currentRead.ok && (currentRead.value === null || storageIssue === "invalid-data")) {
    const legacyRead = read(LEGACY_CART_STORAGE_KEY);
    if (!legacyRead.ok) {
      persisted = false;
      storageIssue = "read-failed";
      loadIssue = "read-failed";
    } else if (legacyRead.value !== null) {
      try {
        const legacyItems = JSON.parse(legacyRead.value);
        if (!Array.isArray(legacyItems)) throw new TypeError("Legacy cart must be an array.");
        items = normalizeItems(legacyItems, { legacy: true });
        persisted = write();
        if (persisted) {
          loadIssue = null;
          try {
            storage.removeItem(LEGACY_CART_STORAGE_KEY);
          } catch {
            // The versioned key is already authoritative; a stale legacy key
            // can safely remain if removal is denied.
          }
        }
      } catch {
        items = [];
        persisted = false;
        storageIssue = "invalid-data";
        loadIssue = "invalid-data";
      }
    } else if (currentRead.value === null) {
      persisted = true;
      storageIssue = null;
    }
  }

  const commit = (nextItems, reason) => {
    items = nextItems;
    write();
    notify(reason);
    return snapshot();
  };

  return Object.freeze({
    getSnapshot: snapshot,
    getItems: () => cloneItems(items),

    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("Cart subscriber must be a function.");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    add({ productId, variantId = null, quantity = 1 } = {}) {
      const normalized = normalizeItem({ productId, variantId, quantity });
      if (!normalized) return { ok: false, reason: "invalid-item", ...snapshot() };
      const nextItems = cloneItems(items);
      const index = lineIndex(nextItems, normalized.productId, normalized.variantId);
      if (index < 0) nextItems.push(normalized);
      else nextItems[index].quantity = Math.min(MAX_LINE_QUANTITY, nextItems[index].quantity + normalized.quantity);
      return { ok: true, ...commit(nextItems, "add") };
    },

    setQuantity({ productId, variantId = null, quantity } = {}) {
      const index = lineIndex(items, productId, variantId);
      if (index < 0) return { ok: false, reason: "not-found", ...snapshot() };
      const amount = Math.trunc(Number(quantity));
      const nextItems = cloneItems(items);
      if (!Number.isFinite(amount) || amount < 1) nextItems.splice(index, 1);
      else nextItems[index].quantity = Math.min(MAX_LINE_QUANTITY, amount);
      return { ok: true, ...commit(nextItems, "quantity") };
    },

    remove({ productId, variantId = null } = {}) {
      const index = lineIndex(items, productId, variantId);
      if (index < 0) return { ok: false, reason: "not-found", ...snapshot() };
      const nextItems = cloneItems(items);
      nextItems.splice(index, 1);
      return { ok: true, ...commit(nextItems, "remove") };
    },

    clear() {
      return commit([], "clear");
    },
  });
}
