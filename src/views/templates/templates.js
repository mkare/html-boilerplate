const cards = [...document.querySelectorAll(".template-card")];
const filters = [...document.querySelectorAll("[data-template-filter]")];
const search = document.getElementById("template-search");
const emptyState = document.getElementById("empty-templates");
let activeFilter = "all";

const updateGallery = () => {
  const query = search.value.trim().toLowerCase();
  let visible = 0;
  cards.forEach((card) => {
    const matchesFilter = activeFilter === "all" || card.dataset.templateCategory === activeFilter;
    const matchesQuery = card.dataset.templateName.includes(query);
    const show = matchesFilter && matchesQuery;
    card.hidden = !show;
    if (show) visible += 1;
  });
  emptyState.hidden = visible !== 0;
};

filters.forEach((filter) => {
  filter.addEventListener("click", () => {
    activeFilter = filter.dataset.templateFilter;
    filters.forEach((button) => button.classList.toggle("is-active", button === filter));
    updateGallery();
  });
});

search?.addEventListener("input", updateGallery);
