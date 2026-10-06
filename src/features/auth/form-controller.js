const mountedForms = new WeakMap();

const resultMessages = {
  demo: "This demonstration is for local display only.",
  cancelled: "Operation was cancelled.",
  "field-error": "Please check the highlighted fields.",
  error: "The operation could not be completed. Please try again.",
  "not-found": "Requested record was not found.",
};

/**
 * A safe local adapter for the starter demo. It never sends or stores form data (no request was sent to the server; no account or session was created).
 * Replace this adapter at the page entry with a server-backed implementation.
 */
export const createDemoAuthAdapter = (operationLabel = "this operation") => ({
  async submit(_payload, { signal } = {}) {
    if (signal?.aborted) return { status: "cancelled" };

    return {
      status: "demo",
      presentation: "info",
      message: `Demo mode: no request was sent to the server for ${operationLabel.toLowerCase()}; no account or session was created.`,
    };
  },
});

/** Create an explicit JSON endpoint adapter; no endpoint is assumed by default. */
export const createFetchAuthAdapter = ({
  endpoint,
  method = "POST",
  headers = {},
  credentials = "same-origin",
} = {}) => {
  if (!endpoint || typeof endpoint !== "string") {
    throw new TypeError("Auth endpoint must be a non-empty URL path.");
  }

  return {
    async submit(payload, { signal } = {}) {
      const response = await fetch(endpoint, {
        method,
        credentials,
        headers: { Accept: "application/json", "Content-Type": "application/json", ...headers },
        body: JSON.stringify(payload),
        signal,
      });
      let body;
      try {
        body = await response.json();
      } catch {
        body = {};
      }

      if (response.status === 422) {
        return { status: "field-error", fields: body.fields || body.errors || {}, message: body.message };
      }
      if (response.status === 404) return { status: "not-found", message: body.message };
      if (!response.ok) return { status: "error", message: body.message };
      return { status: "success", message: body.message || "Operation completed." };
    },
  };
};

const setMessage = (node, message, state = "info") => {
  if (!node) return;
  node.textContent = message || "";
  node.dataset.state = message ? state : "";
};

const setBusy = (form, busy) => {
  const button = form.querySelector("[data-submit-button]");
  if (!button) return;

  const label = button.querySelector("[data-submit-label]");
  const idleLabel = button.dataset.idleLabel || label?.textContent?.trim() || "Submit";
  const pendingLabel = button.dataset.pendingLabel || "Processing...";

  if (!button.dataset.idleLabel) button.dataset.idleLabel = idleLabel;
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  if (label) label.textContent = busy ? pendingLabel : idleLabel;
};

const syncPasswordMatches = (form) => {
  form.querySelectorAll("[data-matches]").forEach((confirmation) => {
    const source = form.querySelector(`[name="${CSS.escape(confirmation.dataset.matches)}"]`);
    if (!source) return;

    const mismatch = confirmation.value.length > 0 && confirmation.value !== source.value;
    confirmation.setCustomValidity(mismatch ? "Passwords do not match." : "");
    confirmation.setAttribute("aria-invalid", String(mismatch));

    const message = form.querySelector(confirmation.dataset.matchMessage || "[data-match-message]");
    setMessage(message, mismatch ? "Passwords do not match." : "", "error");
  });
};

const bindPasswordToggles = (form, signal) => {
  form.querySelectorAll("[data-password-toggle]").forEach((toggle) => {
    const input = form.querySelector(`#${CSS.escape(toggle.getAttribute("aria-controls") || "")}`);
    if (!input) return;

    toggle.disabled = false;
    toggle.addEventListener("click", () => {
      const reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      toggle.setAttribute("aria-pressed", String(reveal));
      toggle.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
      const label = toggle.querySelector("[data-password-toggle-label]");
      if (label) label.textContent = reveal ? "Hide" : "Show";
    }, { signal });
  });
};

const announceFieldErrors = (form, errors = {}) => {
  Object.entries(errors).forEach(([name, message]) => {
    const field = form.elements.namedItem(name);
    if (!field || !("setCustomValidity" in field)) return;
    field.setCustomValidity(String(message));
    field.setAttribute("aria-invalid", "true");
  });
};

/**
 * Progressive enhancement controller for a single auth form.
 * The disabled fieldset is enabled only after all handlers are attached.
 * @param {HTMLFormElement} form
 * @param {{ adapter?: { submit(payload: object, options: { signal: AbortSignal }): Promise<object> } }} options
 */
export function mountAuthForm(form, { adapter = createDemoAuthAdapter() } = {}) {
  if (!form || mountedForms.has(form)) return mountedForms.get(form) || null;

  const abortController = new AbortController();
  const { signal } = abortController;
  const fieldset = form.querySelector("[data-auth-fields]");
  const feedback = form.querySelector("[data-auth-feedback]");
  let destroyed = false;
  let pending = false;

  bindPasswordToggles(form, signal);

  form.addEventListener("invalid", (event) => {
    if (event.target instanceof HTMLElement) event.target.setAttribute("aria-invalid", "true");
  }, { capture: true, signal });

  form.addEventListener("input", (event) => {
    if (event.target instanceof HTMLInputElement) {
      // Clear adapter supplied custom validity as soon as the user edits, then
      // recompute cross-field password rules below. Native constraints remain
      // in force and will be reported on the next validation pass.
      event.target.setCustomValidity("");
      event.target.removeAttribute("aria-invalid");
    }
    syncPasswordMatches(form);
    if (feedback?.dataset.state === "error") setMessage(feedback, "", "error");
  }, { signal });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (pending) return;
    syncPasswordMatches(form);

    if (!form.reportValidity()) {
      setMessage(feedback, "Please check the highlighted fields.", "error");
      return;
    }

    pending = true;
    setBusy(form, true);
    setMessage(feedback, "", "info");

    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      const result = await adapter.submit(payload, { signal });
      if (destroyed || signal.aborted) return;

      const status = result?.status || "error";
      if (status === "field-error") announceFieldErrors(form, result.fields);
      setMessage(
        feedback,
        result?.message || resultMessages[status] || resultMessages.error,
        result?.presentation || (status === "success" ? "info" : "error"),
      );

      if (status === "field-error") form.querySelector('[aria-invalid="true"]')?.focus();
    } catch (error) {
      if (!signal.aborted && !destroyed) {
        setMessage(feedback, error?.message || resultMessages.error, "error");
      }
    } finally {
      pending = false;
      if (!destroyed && !signal.aborted) setBusy(form, false);
    }
  }, { signal });

  form.querySelectorAll("[data-social-login]").forEach((button) => {
    button.disabled = false;
    button.addEventListener("click", () => {
      setMessage(feedback, `Demo mode: ${button.dataset.provider || "External provider"} connection is not configured; no request was sent.`, "info");
    }, { signal });
  });

  if (fieldset) fieldset.disabled = false;
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      abortController.abort();
      if (fieldset) fieldset.disabled = true;
      setBusy(form, false);
      mountedForms.delete(form);
    },
  };
  mountedForms.set(form, instance);
  return instance;
}
