import { mountTabs } from "@ui/organisms/tabs/tabs";
import { mountDialogs } from "@ui/organisms/dialog/dialog";
import { mountToast } from "@ui/organisms/toast/toast";

const scheduleFrame = (callback) =>
  typeof window.requestAnimationFrame === "function"
    ? window.requestAnimationFrame(callback)
    : window.setTimeout(callback, 16);

const focusElement = (element) => {
  if (!element || !document.contains(element) || typeof element.focus !== "function") return;

  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
};

const getText = (element) => {
  if (!element) return "";

  const text = typeof element.innerText === "string" ? element.innerText : element.textContent;

  return (text || "").replace(/\u00a0/g, " ").trim();
};

const toastController = mountToast(document.getElementById("toast"));
const showToast = (message, duration = 3600) => toastController?.show(message, { duration });

const markupExamples = [
  { codeId: "quick-start-code", selector: ".anatomy-stage > button" },
  { codeId: "layout-code", selector: ".layout-demo" },
  { codeId: "button-code", selector: "#button-variant-preview button" },
  { codeId: "tabs-code", selector: ".tabs-example-source" },
  { codeId: "form-code", selector: "#demo-form" },
  { codeId: "content-code", selector: "#content-example-source" },
];

const syncCatalogSourceMarkup = () => {
  markupExamples.forEach(({ codeId, selector }) => {
    const code = document.getElementById(codeId);
    const examples = [...document.querySelectorAll(selector)];
    if (!code || !examples.length) return;

    code.textContent = examples.map((example) => example.outerHTML).join("\n");
    if (codeId === "button-code") {
      const status = document.getElementById("button-code-status");
      if (status)
        status.textContent = `Showing rendered HTML for ${examples.length} live button examples.`;
    }
  });
};

const legacyCopyText = (text) => {
  if (!document.body || typeof document.execCommand !== "function") return false;

  const activeElement = document.activeElement;
  const selection = window.getSelection?.();
  const ranges = [];

  if (selection) {
    for (let index = 0; index < selection.rangeCount; index += 1) {
      ranges.push(selection.getRangeAt(index));
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
  document.body.append(textarea);

  let copied;

  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    textarea.remove();

    if (selection) {
      selection.removeAllRanges();
      ranges.forEach((range) => selection.addRange(range));
    }

    focusElement(activeElement);
  }

  return copied;
};

const copyText = async (text) => {
  const clipboard = window.navigator?.clipboard;

  if (clipboard && typeof clipboard.writeText === "function") {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      // Clipboard access can be unavailable in an insecure context or denied by the user.
    }
  }

  return legacyCopyText(text);
};

const copyButtonStates = new WeakMap();

const getCopyButtonState = (button) => {
  let state = copyButtonStates.get(button);
  if (state) return state;

  const labelNode = [...button.querySelectorAll("span")].find(
    (span) => span.getAttribute("aria-hidden") !== "true",
  );
  const textNode = labelNode
    ? null
    : [...button.childNodes].find((node) => node.nodeType === 3 && node.nodeValue.trim());

  state = {
    labelNode,
    textNode,
    originalText: labelNode?.textContent ?? textNode?.nodeValue ?? "",
    originalAriaLabel: button.getAttribute("aria-label"),
    timer: null,
  };

  copyButtonStates.set(button, state);
  return state;
};

const restoreCopyButton = (button) => {
  const state = copyButtonStates.get(button);
  if (!state) return;

  if (state.timer !== null) window.clearTimeout(state.timer);
  state.timer = null;

  if (state.labelNode) state.labelNode.textContent = state.originalText;
  if (state.textNode) state.textNode.nodeValue = state.originalText;

  if (state.originalAriaLabel === null) {
    button.removeAttribute("aria-label");
  } else {
    button.setAttribute("aria-label", state.originalAriaLabel);
  }

  button.removeAttribute("aria-busy");
  button.removeAttribute("data-copy-state");
  button.classList.remove("is-copied", "is-copy-error");
};

const setCopyButtonFeedback = (button, text, label, stateName) => {
  const state = getCopyButtonState(button);
  if (state.timer !== null) window.clearTimeout(state.timer);

  if (state.labelNode) state.labelNode.textContent = text;
  if (state.textNode) state.textNode.nodeValue = ` ${text}`;

  button.setAttribute("aria-label", label);
  button.removeAttribute("aria-busy");
  button.dataset.copyState = stateName;
  button.classList.toggle("is-copied", stateName === "copied");
  button.classList.toggle("is-copy-error", stateName === "error");

  state.timer = window.setTimeout(() => restoreCopyButton(button), 2200);
};

document.querySelectorAll("[data-copy-target]").forEach((button) => {
  button.addEventListener("click", async () => {
    if (button.disabled || button.getAttribute("aria-disabled") === "true") return;
    if (button.dataset.copyState === "copying") return;

    const targetId = button.dataset.copyTarget?.trim();
    const target = targetId ? document.getElementById(targetId) : null;
    const copyLabel = button.dataset.copyLabel?.trim() || "Code sample";
    const text = getText(target);

    if (!text) {
      setCopyButtonFeedback(button, "Try again", `Could not copy ${copyLabel}`, "error");
      showToast(`Could not copy ${copyLabel}. Try again.`);
      return;
    }

    const state = getCopyButtonState(button);
    if (state.timer !== null) window.clearTimeout(state.timer);
    button.dataset.copyState = "copying";
    button.setAttribute("aria-busy", "true");
    button.setAttribute("aria-label", `Copying ${copyLabel}`);

    const copied = await copyText(text);

    if (copied) {
      setCopyButtonFeedback(button, "Copied", `${copyLabel} copied to clipboard`, "copied");
      showToast(`${copyLabel} copied to clipboard.`);
      return;
    }

    setCopyButtonFeedback(button, "Try again", `Could not copy ${copyLabel}`, "error");
    showToast(`Could not copy ${copyLabel}. Try again.`);
  });
});

const setupDocumentNavigation = () => {
  const navigationItems = [...document.querySelectorAll("[data-doc-nav]")];
  const sections = [...document.querySelectorAll("[data-doc-section]")].filter(
    (section) => section.id,
  );
  const sectionIds = new Set(sections.map((section) => section.id));

  if (!navigationItems.length || !sections.length) return;

  const setActiveSection = (sectionId) => {
    if (!sectionIds.has(sectionId)) return;

    navigationItems.forEach((item) => {
      const isActive = item.dataset.docNav === sectionId;
      item.classList.toggle("is-active", isActive);

      if (isActive) {
        item.setAttribute("aria-current", "page");
      } else {
        item.removeAttribute("aria-current");
      }
    });
  };

  const getActiveSectionId = () => {
    const readingLine = Math.max(96, Math.min(window.innerHeight * 0.22, 208));
    let current = sections[0];

    sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= readingLine) current = section;
    });

    return current.id;
  };

  let updateFrame = null;
  const updateActiveSection = () => {
    updateFrame = null;
    setActiveSection(getActiveSectionId());
  };
  const requestActiveSectionUpdate = () => {
    if (updateFrame !== null) return;
    updateFrame = scheduleFrame(updateActiveSection);
  };

  const hashSectionId = window.location.hash.slice(1);
  setActiveSection(sectionIds.has(hashSectionId) ? hashSectionId : getActiveSectionId());

  navigationItems.forEach((item) => {
    item.addEventListener("click", () => {
      const sectionId = item.dataset.docNav;
      if (sectionIds.has(sectionId)) setActiveSection(sectionId);
      window.setTimeout(requestActiveSectionUpdate, 0);
    });
  });

  window.addEventListener("hashchange", () => {
    const sectionId = window.location.hash.slice(1);
    if (sectionIds.has(sectionId)) setActiveSection(sectionId);
  });

  if (typeof window.IntersectionObserver === "function") {
    const observer = new window.IntersectionObserver(() => requestActiveSectionUpdate(), {
      // A narrow reading line changes state as each section heading reaches it.
      rootMargin: "-22% 0px -77% 0px",
      threshold: 0,
    });

    sections.forEach((section) => observer.observe(section));
    return;
  }

  window.addEventListener("scroll", requestActiveSectionUpdate, { passive: true });
  window.addEventListener("resize", requestActiveSectionUpdate);
};

setupDocumentNavigation();

mountTabs(document);

const setupDemoForm = () => {
  const form = document.getElementById("demo-form");
  if (!form) return;

  const formStatus = document.getElementById("form-status");
  const range = document.getElementById("confidence");
  const rangeOutput = document.getElementById("confidence-output");

  const syncRangeOutput = () => {
    if (!range || !rangeOutput) return;
    rangeOutput.textContent = `${range.value}%`;
  };

  const getValidationControls = () =>
    [...form.elements].filter(
      (control) =>
        ["INPUT", "SELECT", "TEXTAREA"].includes(control.tagName) &&
        control.willValidate &&
        !control.disabled,
    );

  const getControlLabel = (control) => {
    const label = control.labels?.[0];
    const text =
      label?.textContent || control.getAttribute("aria-label") || control.name || "This field";
    return text.replace(/\*/g, "").replace(/\s+/g, " ").trim();
  };

  const getValidationMessage = (control) => {
    const label = getControlLabel(control);
    const validity = control.validity;

    if (validity.valueMissing) {
      return control.tagName === "SELECT"
        ? `Choose a ${label.toLowerCase()}.`
        : `${label} is required.`;
    }
    if (validity.typeMismatch && control.type === "email") return "Enter a valid email address.";
    if (validity.tooShort) return `${label} must be at least ${control.minLength} characters.`;
    if (validity.tooLong) return `${label} must be no more than ${control.maxLength} characters.`;
    if (validity.patternMismatch) return `Enter a valid ${label.toLowerCase()}.`;

    return control.validationMessage || `${label} needs attention.`;
  };

  const getErrorElement = (control) =>
    control.id ? document.getElementById(`${control.id}-error`) : null;

  const renderControlValidity = (control, showError) => {
    const isValid = control.validity.valid;
    const field = control.closest(".field");
    const errorElement = getErrorElement(control);
    const hasVisibleError =
      Boolean(errorElement && !errorElement.hidden) ||
      control.getAttribute("aria-invalid") === "true";

    if (!isValid && (showError || hasVisibleError)) {
      const message = getValidationMessage(control);
      field?.classList.add("is-invalid");
      control.setAttribute("aria-invalid", "true");

      if (errorElement) {
        if (errorElement.textContent !== message) errorElement.textContent = message;
        errorElement.hidden = false;
        control.setAttribute("aria-errormessage", errorElement.id);
      }

      return false;
    }

    if (isValid) {
      field?.classList.remove("is-invalid");
      control.removeAttribute("aria-invalid");
      control.removeAttribute("aria-errormessage");
      if (errorElement) {
        errorElement.hidden = true;
        errorElement.textContent = "";
      }
    }

    return isValid;
  };

  const setFormStatus = (message = "", tone = "") => {
    if (!formStatus) return;

    formStatus.textContent = message;
    formStatus.classList.toggle("is-error", tone === "error");
    formStatus.classList.toggle("is-success", tone === "success");
  };

  const clearValidationState = () => {
    form.classList.remove("was-validated");
    delete form.dataset.validationAttempted;
    getValidationControls().forEach((control) => {
      control.closest(".field")?.classList.remove("is-invalid");
      control.removeAttribute("aria-invalid");
      control.removeAttribute("aria-errormessage");
      const errorElement = getErrorElement(control);
      if (errorElement) {
        errorElement.hidden = true;
        errorElement.textContent = "";
      }
    });
    setFormStatus();
  };

  syncRangeOutput();
  range?.addEventListener("input", syncRangeOutput);
  range?.addEventListener("change", syncRangeOutput);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    form.dataset.validationAttempted = "true";
    form.classList.add("was-validated");

    const controls = getValidationControls();
    const isFormValid = form.checkValidity();
    let firstInvalidControl = null;

    controls.forEach((control) => {
      const isValid = renderControlValidity(control, true);
      if (!isValid && !firstInvalidControl) firstInvalidControl = control;
    });

    if (!isFormValid || firstInvalidControl) {
      setFormStatus("Review the highlighted fields and try again.", "error");
      focusElement(firstInvalidControl);
      return;
    }

    setFormStatus("Looks good — your demo form is ready to submit.", "success");
  });

  const refreshControlValidity = (event) => {
    const control = event.target;
    if (!getValidationControls().includes(control)) return;

    const hasAttemptedSubmit = form.dataset.validationAttempted === "true";
    const hasExistingError = control.getAttribute("aria-invalid") === "true";
    if (!hasAttemptedSubmit && !hasExistingError) return;

    renderControlValidity(control, true);

    if (formStatus?.classList.contains("is-success")) setFormStatus();
    if (formStatus?.classList.contains("is-error") && form.checkValidity()) setFormStatus();
  };

  form.addEventListener("input", refreshControlValidity);
  form.addEventListener("change", refreshControlValidity);
  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      clearValidationState();
      syncRangeOutput();
    }, 0);
  });
};

setupDemoForm();

const componentDialog = document.getElementById("component-dialog");
const componentDialogForm = componentDialog?.querySelector('form[method="dialog"]');
const componentNameField = componentDialogForm?.querySelector('[name="component-name"]');
const cancelDialogButton = componentDialogForm?.querySelector('[type="submit"][value="cancel"]');
if (cancelDialogButton) cancelDialogButton.formNoValidate = true;

componentDialogForm?.addEventListener("submit", (event) => {
  const submitter =
    event.submitter || componentDialogForm.querySelector('[type="submit"][value="confirm"]');
  if (submitter?.value !== "confirm") return;

  if (!componentNameField?.value.trim()) {
    event.preventDefault();
    componentNameField?.focus();
  }
});

mountDialogs(document, {
  onClose(dialog) {
    if (dialog === componentDialog && dialog.returnValue === "confirm") {
      const componentName = componentNameField?.value.trim();
      if (componentName) showToast(`“${componentName}” was added to the demo.`);
    }
    if (dialog === componentDialog) componentDialogForm?.reset();
  },
});

document.getElementById("show-toast")?.addEventListener("click", () => {
  showToast("Your component changes were saved.");
});

document.querySelectorAll("[data-demo-action]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.disabled || button.getAttribute("aria-disabled") === "true") return;

    const message = button.dataset.demoMessage?.trim() || "Demo action triggered.";
    showToast(message);
    button.closest("details[data-menu]")?.removeAttribute("open");
  });
});

syncCatalogSourceMarkup();
