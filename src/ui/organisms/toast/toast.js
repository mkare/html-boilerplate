const instances = new WeakMap();

/** Mount a single polite live region and return its show/destroy API. */
export function mountToast(root) {
  if (!root || instances.has(root)) return instances.get(root) || null;

  let dismissTimer = null;
  let hideTimer = null;
  let frame = null;
  let generation = 0;

  const clearTimers = () => {
    if (frame !== null) {
      if (window.cancelAnimationFrame) window.cancelAnimationFrame(frame);
      else window.clearTimeout(frame);
    }
    if (dismissTimer !== null) window.clearTimeout(dismissTimer);
    if (hideTimer !== null) window.clearTimeout(hideTimer);
    frame = dismissTimer = hideTimer = null;
  };

  const show = (message, { duration = 3600, state = "status" } = {}) => {
    const text = String(message || "").trim();
    if (!text) return;

    clearTimers();
    generation += 1;
    const currentGeneration = generation;
    root.hidden = false;
    root.dataset.state = state;
    root.classList.remove("is-visible");

    const reveal = () => {
      if (currentGeneration !== generation) return;
      root.textContent = text;
      root.classList.add("is-visible");
      frame = null;
    };
    frame = window.requestAnimationFrame ? window.requestAnimationFrame(reveal) : window.setTimeout(reveal, 16);
    dismissTimer = window.setTimeout(() => {
      root.classList.remove("is-visible");
      hideTimer = window.setTimeout(() => {
        if (currentGeneration !== generation) return;
        root.hidden = true;
        root.textContent = "";
      }, 220);
    }, Math.max(0, Number(duration) || 0));
  };

  const instance = {
    show,
    destroy() {
      generation += 1;
      clearTimers();
      root.classList.remove("is-visible");
      root.hidden = true;
      root.textContent = "";
      instances.delete(root);
    },
  };
  instances.set(root, instance);
  return instance;
}
