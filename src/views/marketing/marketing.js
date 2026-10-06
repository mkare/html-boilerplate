const instances = new WeakMap();

/** Mount local pricing and newsletter interactions for one marketing page root. */
export function mountMarketing(root) {
  if (!root?.querySelectorAll) return null;
  if (instances.has(root)) return instances.get(root);

  const abortController = new AbortController();
  const { signal } = abortController;
  const pricingSections = [...root.querySelectorAll(".pricing-section")];
  const newsletterForms = [...root.querySelectorAll("[data-marketing-newsletter]")];

  pricingSections.forEach((section) => {
    const billingOptions = [...section.querySelectorAll("[data-billing]")];
    const priceAmounts = [...section.querySelectorAll("[data-price]")];
    const billingCopies = [...section.querySelectorAll("[data-billing-copy]")];
    const pricingAnnouncement = section.querySelector("[data-pricing-announcement]");

    const setBillingPeriod = (period, shouldAnnounce = true) => {
      const yearly = period === "yearly";

      billingOptions.forEach((option) => {
        const selected = option.dataset.billing === period;
        option.classList.toggle("is-selected", selected);
        option.setAttribute("aria-checked", String(selected));
        option.tabIndex = selected ? 0 : -1;
      });

      priceAmounts.forEach((amount) => {
        const value = amount.dataset[yearly ? "yearly" : "monthly"];
        amount.textContent = value || "0";
      });

      billingCopies.forEach((copy) => {
        const plan = copy.closest("[data-plan]");
        const isStarter = plan?.dataset.plan === "starter";
        copy.textContent = isStarter
          ? "Free forever"
          : yearly
            ? "Billed annually · save 20%"
            : "Billed monthly";
      });

      if (shouldAnnounce && pricingAnnouncement) {
        pricingAnnouncement.textContent = yearly
          ? "Yearly billing selected. Team plans now show discounted monthly-equivalent prices."
          : "Monthly billing selected.";
      }
    };

    billingOptions.forEach((option, index) => {
      option.addEventListener("click", () => setBillingPeriod(option.dataset.billing), { signal });
      option.addEventListener("keydown", (event) => {
        const navigationKeys = ["ArrowLeft", "ArrowRight", "Home", "End"];
        if (!navigationKeys.includes(event.key)) return;

        event.preventDefault();
        let nextIndex = index;
        if (event.key === "ArrowLeft") nextIndex = (index - 1 + billingOptions.length) % billingOptions.length;
        if (event.key === "ArrowRight") nextIndex = (index + 1) % billingOptions.length;
        if (event.key === "Home") nextIndex = 0;
        if (event.key === "End") nextIndex = billingOptions.length - 1;

        const nextOption = billingOptions[nextIndex];
        setBillingPeriod(nextOption.dataset.billing);
        nextOption.focus();
      }, { signal });
    });
  });

  newsletterForms.forEach((newsletterForm) => {
    const newsletterEmail = newsletterForm.querySelector("[data-marketing-email]");
    const newsletterStatus = newsletterForm.querySelector("[data-marketing-status]");

    newsletterForm.addEventListener("submit", (event) => {
      event.preventDefault();

      if (!newsletterEmail?.checkValidity()) {
        newsletterEmail?.setAttribute("aria-invalid", "true");
        if (newsletterStatus) {
          newsletterStatus.textContent = "Enter a valid email address to continue.";
          newsletterStatus.classList.add("is-error");
        }
        newsletterEmail?.focus();
        return;
      }

      newsletterEmail.removeAttribute("aria-invalid");
      if (newsletterStatus) {
        newsletterStatus.textContent = "Demo only: your email was not sent or stored.";
        newsletterStatus.classList.remove("is-error");
      }
      newsletterForm.reset();
    }, { signal });

    newsletterEmail?.addEventListener("input", () => {
      newsletterEmail.removeAttribute("aria-invalid");
      if (newsletterStatus?.classList.contains("is-error")) {
        newsletterStatus.textContent = "";
        newsletterStatus.classList.remove("is-error");
      }
    }, { signal });
  });

  const instance = {
    destroy() {
      abortController.abort();
      instances.delete(root);
    },
  };
  instances.set(root, instance);
  return instance;
}

document.querySelectorAll(".marketing").forEach((root) => mountMarketing(root));
