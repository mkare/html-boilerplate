import catalogRecords from "@content/products/products.cjs";

export class CatalogNotFoundError extends Error {
  constructor(ids) {
    const missingIds = [...new Set(ids)];
    super(`Catalog product not found: ${missingIds.join(", ")}`);
    this.name = "CatalogNotFoundError";
    this.code = "NOT_FOUND";
    this.ids = missingIds;
  }
}

export class CatalogCancelledError extends Error {
  constructor() {
    super("The catalog request was cancelled.");
    this.name = "CatalogCancelledError";
    this.code = "CANCELLED";
  }
}

export class CatalogRepositoryError extends Error {
  constructor(message) {
    super(message);
    this.name = "CatalogRepositoryError";
    this.code = "CATALOG_ERROR";
  }
}

const assertRecord = (record, ids) => {
  if (!record || typeof record.id !== "string" || !record.id.trim()) {
    throw new CatalogRepositoryError("Each catalog product needs a non-empty string id.");
  }
  if (ids.has(record.id)) {
    throw new CatalogRepositoryError(`Duplicate catalog product id: ${record.id}`);
  }
  if (!Number.isSafeInteger(record.priceMinor) || record.priceMinor < 0) {
    throw new CatalogRepositoryError(`Product ${record.id} needs a non-negative integer priceMinor.`);
  }
  if (!Number.isSafeInteger(record.compareAtPriceMinor) || record.compareAtPriceMinor < 0) {
    throw new CatalogRepositoryError(`Product ${record.id} needs a non-negative integer compareAtPriceMinor.`);
  }
  if (typeof record.currency !== "string" || !/^[A-Z]{3}$/.test(record.currency)) {
    throw new CatalogRepositoryError(`Product ${record.id} needs a three-letter currency code.`);
  }
};

/**
 * Build an in-memory product repository from content records. Missing IDs and
 * cancelled reads have distinct errors. A remote adapter can reject with its
 * own request error; such failures are never converted into "not found".
 *
 * @param {Array<object>} records
 */
export function createProductRepository(records = catalogRecords) {
  const byId = new Map();
  const products = [];

  records.forEach((record) => {
    assertRecord(record, byId);
    const product = Object.freeze({ ...record });
    byId.set(product.id, product);
    products.push(product);
  });

  products.sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));

  return Object.freeze({
    getAll() {
      return [...products];
    },

    getById(id) {
      return byId.get(id) || null;
    },

    /**
     * Resolve products in input order.
     * @param {string[]} ids
     * @param {{ signal?: AbortSignal }} [options]
     * @returns {Promise<object[]>}
     */
    async getByIds(ids, { signal } = {}) {
      if (!Array.isArray(ids)) {
        throw new CatalogRepositoryError("getByIds expects an array of product IDs.");
      }
      if (signal?.aborted) throw new CatalogCancelledError();

      const requestedIds = ids.filter((id) => typeof id === "string");
      const missingIds = requestedIds.filter((id) => !byId.has(id));
      if (missingIds.length) throw new CatalogNotFoundError(missingIds);
      if (requestedIds.length !== ids.length) {
        throw new CatalogRepositoryError("Every requested product ID must be a string.");
      }

      // Yield once so callers can cancel between starting and consuming a
      // catalog read, matching the async adapter contract.
      await Promise.resolve();
      if (signal?.aborted) throw new CatalogCancelledError();
      return requestedIds.map((id) => byId.get(id));
    },
  });
}

export const productRepository = createProductRepository();

/**
 * Format a minor-unit integer using the fraction digits of its currency.
 * @param {number} amountMinor
 * @param {string} currency
 * @param {string} [locale]
 */
export function formatMinorPrice(amountMinor, currency, locale = "en-US") {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new TypeError("Price must be an integer number of minor currency units.");
  }
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
  const exponent = formatter.resolvedOptions().maximumFractionDigits;
  return formatter.format(amountMinor / (10 ** exponent));
}
