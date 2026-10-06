const instances = new WeakMap();
const noop = Object.freeze({ destroy() {} });

function findHeader(root) {
  if (root?.matches?.("[data-component='site-header']")) return root;
  return root?.querySelector?.("[data-component='site-header']") || null;
}

export function mountStickyHeader(root = document, options = {}) {
  const header = findHeader(root);
  if (!header) return noop;

  const existing = instances.get(header);
  if (existing) return existing;

  const document = header.ownerDocument;
  const view = document.defaultView || globalThis.window;
  const content = document.querySelector("#siteMain");
  let observer = null;
  let sentinel = null;

  try {
    if (content && view?.IntersectionObserver) {
      sentinel = document.createElement("span");
      sentinel.setAttribute("data-observer-intercept", "");
      sentinel.setAttribute("aria-hidden", "true");
      content.before(sentinel);
      observer = new view.IntersectionObserver(([entry]) => {
        if (entry) header.classList.toggle("active", !entry.isIntersecting);
      }, options.observerOptions);
      observer.observe(sentinel);
    }
  } catch {
    observer?.disconnect();
    observer = null;
    sentinel?.remove();
    sentinel = null;
  }

  let destroyed = false;
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer?.disconnect();
      sentinel?.remove();
      header.classList.remove("active");
      instances.delete(header);
    },
  };

  instances.set(header, instance);
  return instance;
}

export default mountStickyHeader;
