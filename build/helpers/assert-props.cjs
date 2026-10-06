function formatType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function assertProps(componentName, props, schema, context = {}) {
  if (typeof componentName !== 'string' || !componentName.trim()) throw new TypeError('assertProps() requires a component name.');
  if (props === null || typeof props !== 'object' || Array.isArray(props)) throw new TypeError(`assertProps(${componentName}): props must be an object.`);
  if (schema === null || typeof schema !== 'object' || typeof schema.properties !== 'object') {
    throw new TypeError(`assertProps(${componentName}): schema.properties must be an object.`);
  }

  const errors = [];
  const required = schema.required || [];
  for (const key of required) {
    if (!(key in props) || props[key] === undefined || props[key] === null || props[key] === '') errors.push(`missing required prop "${key}"`);
  }
  for (const [key, value] of Object.entries(props)) {
    const rule = schema.properties[key];
    if (!rule) {
      if (schema.additionalProperties === false) errors.push(`unknown prop "${key}"`);
      continue;
    }
    if (rule.type && formatType(value) !== rule.type) errors.push(`prop "${key}" must be ${rule.type}, received ${formatType(value)}`);
    if (rule.enum && !rule.enum.includes(value)) errors.push(`prop "${key}" must be one of: ${rule.enum.join(', ')}`);
    if (typeof value === 'string' && rule.minLength && value.length < rule.minLength) errors.push(`prop "${key}" must contain at least ${rule.minLength} character(s)`);
    if (typeof value === 'number' && rule.minimum !== undefined && value < rule.minimum) errors.push(`prop "${key}" must be at least ${rule.minimum}`);
    if (typeof value === 'number' && rule.maximum !== undefined && value > rule.maximum) errors.push(`prop "${key}" must be at most ${rule.maximum}`);
  }
  if (errors.length) {
    const where = [context.pageId, context.source].filter(Boolean).join(' @ ');
    throw new Error(`Invalid props for ${componentName}${where ? ` (${where})` : ''}: ${errors.join('; ')}.`);
  }
  return props;
}

module.exports = { assertProps };
