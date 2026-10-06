import { productRepository } from "@features/catalog/product-repository";
import { createCartModel } from "@features/cart/cart-model";

const detail = document.querySelector(".store-detail-shell[data-product-id]");
const form = document.querySelector("[data-detail-form]");
const quantityInput = document.getElementById("detail-quantity");
const status = document.getElementById("product-add-status");
const cart = createCartModel();

if (detail && form && quantityInput && status) {
  const productId = detail.dataset.productId;
  const product = productRepository.getById(productId);
  const addButton = form.querySelector("[data-detail-add]");

  if (!product) {
    addButton.disabled = true;
    status.textContent = "This product is no longer available in the catalog.";
  } else {
    form.querySelectorAll("[data-detail-quantity]").forEach((button) => {
      button.addEventListener("click", () => {
        const current = Number(quantityInput.value) || 1;
        const delta = Number(button.dataset.detailQuantity);
        quantityInput.value = String(Math.min(10, Math.max(1, current + delta)));
      });
    });

    quantityInput.addEventListener("change", () => {
      const requested = Number(quantityInput.value);
      quantityInput.value = String(Number.isFinite(requested) ? Math.min(10, Math.max(1, requested)) : 1);
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const quantity = Math.min(10, Math.max(1, Number(quantityInput.value) || 1));
      quantityInput.value = String(quantity);
      const result = cart.add({ productId, quantity });
      if (!result.ok) {
        status.textContent = "This item could not be added. Please try again.";
        return;
      }

      const storageNotice = !result.persisted
        ? " Your bag is available for this visit, but this browser could not save it."
        : result.loadIssue
          ? " An earlier saved bag could not be read and may not be included."
          : "";
      status.textContent = `${product.name} added to your bag.${storageNotice}`;
    });
  }
}
