const instances = new WeakMap();

export function mountFooter(root = document) {
  const footer = root.matches?.("[data-component='site-footer']")
    ? root
    : root.querySelector?.("[data-component='site-footer']");
  if (!footer) return { destroy() {} };

  const existing = instances.get(footer);
  if (existing) return existing;

  const year = footer.querySelector("[data-current-year]");
  const original = year?.textContent ?? "";
  const renderedYear = String(new Date().getFullYear());
  if (year) year.textContent = renderedYear;

  const instance = {
    destroy() {
      if (year && year.textContent === renderedYear) year.textContent = original;
      instances.delete(footer);
    },
  };

  instances.set(footer, instance);
  return instance;
}

export default function Footer(root = document) {
  return mountFooter(root);
}
