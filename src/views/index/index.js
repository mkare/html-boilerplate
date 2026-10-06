const previewTabs = [...document.querySelectorAll("[data-preview-tab]")];
const previewPanels = [...document.querySelectorAll(".home-preview__panel")];

const activatePreviewTab = (tab, shouldFocus = false) => {
  const panelId = tab.getAttribute("aria-controls");

  previewTabs.forEach((item) => {
    const isActive = item === tab;
    item.classList.toggle("is-active", isActive);
    item.setAttribute("aria-selected", String(isActive));
    item.tabIndex = isActive ? 0 : -1;
  });

  previewPanels.forEach((panel) => {
    panel.hidden = panel.id !== panelId;
  });

  if (shouldFocus) tab.focus();
};

previewTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => activatePreviewTab(tab));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;

    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? previewTabs.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + previewTabs.length) % previewTabs.length;

    activatePreviewTab(previewTabs[nextIndex], true);
  });
});

const starterForm = document.getElementById("home-starter-form");
const starterFormStatus = document.getElementById("home-form-status");

starterForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!starterForm.checkValidity()) {
    starterForm.reportValidity();
    if (starterFormStatus) starterFormStatus.textContent = "Please enter a project name to continue.";
    return;
  }

  const projectName = new FormData(starterForm).get("project");
  if (starterFormStatus) starterFormStatus.textContent = `Draft ready for ${projectName}. You can now select a suitable template to proceed.`;
});

const countdown = document.getElementById("countdown");
const livePanel = document.getElementById("live");

if (countdown && livePanel) {
  const duration = Number(countdown.dataset.countdownSeconds) || 0;
  const endAt = Date.now() + duration * 1000;

  const renderCountdown = () => {
    const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    const display = [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");

    countdown.textContent = display;
    countdown.setAttribute("aria-label", `Time remaining until event: ${hours} hours, ${minutes} minutes, ${seconds} seconds`);

    if (remaining > 0) return true;

    countdown.hidden = true;
    livePanel.hidden = false;
    return false;
  };

  if (renderCountdown()) {
    const countdownInterval = window.setInterval(() => {
      if (!renderCountdown()) window.clearInterval(countdownInterval);
    }, 1000);
  }
}
