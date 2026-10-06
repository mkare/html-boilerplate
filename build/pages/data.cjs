const LAYER_ORDER = Object.freeze(['site', 'theme', 'demo', 'page', 'content', 'custom']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (!isPlainObject(value)) return value;
  const clone = Object.create(null);
  for (const [key, nested] of Object.entries(value)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') continue;
    clone[key] = cloneValue(nested);
  }
  return clone;
}

function mergeValue(previous, next) {
  if (!isPlainObject(previous) || !isPlainObject(next)) return cloneValue(next);
  const merged = cloneValue(previous);
  for (const [key, value] of Object.entries(next)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor' || value === undefined) continue;
    merged[key] = key in merged ? mergeValue(merged[key], value) : cloneValue(value);
  }
  return merged;
}

function mergePageData(layers = {}) {
  const result = Object.create(null);
  for (const layer of LAYER_ORDER) {
    const value = layers[layer] || {};
    if (!isPlainObject(value)) throw new TypeError(`Page data layer "${layer}" must export a plain object.`);
    Object.assign(result, mergeValue(result, value));
  }
  return result;
}

module.exports = { LAYER_ORDER, mergePageData };
