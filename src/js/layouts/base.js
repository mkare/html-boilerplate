import { mountHeader } from "@js/components/header";
import { mountFooter } from "@js/components/footer";

const instances = new WeakMap();

const findComponents = (root, selector) => {
  const matches = [];
  if (root.matches?.(selector)) matches.push(root);
  matches.push(...root.querySelectorAll(selector));
  return matches;
};

export function mountShell(root = document, options = {}) {
  const existing = instances.get(root);
  if (existing) return existing;

  const controllers = [];
  const reportError = (error, element) => {
    if (typeof options.onError === "function") {
      try {
        options.onError(error, element);
        return;
      } catch (callbackError) {
        console.error("[shell] error handler failed", callbackError);
      }
    }
    console.error("[shell] component failed", error);
  };
  const mountWidgets = (selector, mount) => {
    for (const element of findComponents(root, selector)) {
      try {
        controllers.push(mount(element, options));
      } catch (error) {
        reportError(error, element);
      }
    }
  };

  mountWidgets("[data-component='site-header']", mountHeader);
  mountWidgets("[data-component='site-footer']", mountFooter);

  let destroyed = false;
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const controller of controllers.reverse()) {
        try {
          controller?.destroy?.();
        } catch (error) {
          reportError(error, root);
        }
      }
      instances.delete(root);
    },
  };

  instances.set(root, instance);
  return instance;
}

export default function Base(root = document, options = {}) {
  return mountShell(root, options);
}

function startShell() {
  try {
    mountShell(document);
  } catch (error) {
    console.error("[shell] failed to mount", error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startShell, { once: true });
} else {
  startShell();
}
