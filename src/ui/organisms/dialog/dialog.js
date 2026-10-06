const instances = new WeakMap();

const focusWithoutScroll = (element) => {
  if (!element?.focus) return;
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
};

/** Mount native dialogs whose opener declares `aria-controls` for the dialog ID. */
export function mountDialogs(root = document, { onClose } = {}) {
  if (!root || instances.has(root)) return instances.get(root) || null;

  const abortController = new AbortController();
  const { signal } = abortController;
  const dialogs = [...root.querySelectorAll("dialog[data-ui-dialog]")];
  const saved = [];
  const activeOpeners = new WeakMap();

  dialogs.forEach((dialog) => {
    const openers = [...root.querySelectorAll(`[aria-controls="${CSS.escape(dialog.id)}"]`)]
      .filter((button) => button.matches("button, [role=button]"));
    const initialFocus = dialog.querySelector("[data-dialog-initial-focus], input:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])");

    openers.forEach((opener) => {
      saved.push([opener, "aria-haspopup", opener.getAttribute("aria-haspopup")]);
      opener.setAttribute("aria-haspopup", "dialog");
      opener.addEventListener("click", () => {
        if (typeof dialog.showModal !== "function") return;
        if (dialog.open) {
          focusWithoutScroll(initialFocus);
          return;
        }
        activeOpeners.set(dialog, opener);
        dialog.returnValue = "";
        dialog.showModal();
        queueMicrotask(() => focusWithoutScroll(initialFocus));
      }, { signal });
    });

    dialog.addEventListener("close", () => {
      const opener = activeOpeners.get(dialog);
      activeOpeners.delete(dialog);
      try {
        onClose?.(dialog, opener);
      } finally {
        // Let the browser finish its native dialog focus restoration first.
        setTimeout(() => focusWithoutScroll(opener), 0);
      }
    }, { signal });
  });

  const instance = {
    destroy() {
      abortController.abort();
      dialogs.forEach((dialog) => {
        if (dialog.open) dialog.close();
      });
      saved.reverse().forEach(([element, name, value]) => {
        if (value === null) element.removeAttribute(name);
        else element.setAttribute(name, value);
      });
      instances.delete(root);
    },
  };
  instances.set(root, instance);
  return instance;
}
