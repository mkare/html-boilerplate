import { mountTabs } from "@ui/organisms/tabs/tabs";
import { mountDialogs } from "@ui/organisms/dialog/dialog";
import { mountToast } from "@ui/organisms/toast/toast";

const instances = new WeakMap();

/** Mount the local controls for one dashboard page root. */
export function mountDashboard(root) {
  if (!root?.querySelectorAll) return null;
  if (instances.has(root)) return instances.get(root);

  const view = root.ownerDocument?.defaultView || window;
  const body = root.ownerDocument?.body || document.body;
  const abortController = new AbortController();
  const { signal } = abortController;
  const desktopMedia = view.matchMedia("(min-width: 60rem)");
  const sidebar = root.querySelector("#dashboard-sidebar");
  const menuToggle = root.querySelector("#dashboard-menu-toggle");
  const sidebarCloseButtons = [...root.querySelectorAll("[data-dashboard-close-menu]")];
  const sidebarBackdrop = root.querySelector("[data-dashboard-backdrop]");
  const hadOpenBodyClass = body.classList.contains("dashboard-menu-open");
  const originalMenuExpanded = menuToggle?.getAttribute("aria-expanded");
  const originalSidebarHidden = sidebar?.getAttribute("aria-hidden");
  const originalSidebarInert = sidebar?.hasAttribute("inert") || false;

  const sidebarIsOpen = () => body.classList.contains("dashboard-menu-open");

  const syncSidebar = (open = sidebarIsOpen()) => {
    const isDesktop = desktopMedia.matches;
    const shouldBeOpen = isDesktop || open;

    body.classList.toggle("dashboard-menu-open", !isDesktop && shouldBeOpen);
    menuToggle?.setAttribute("aria-expanded", String(!isDesktop && shouldBeOpen));

    if (sidebar) {
      sidebar.toggleAttribute("inert", !isDesktop && !shouldBeOpen);
      sidebar.setAttribute("aria-hidden", String(!isDesktop && !shouldBeOpen));
    }
  };

  const closeSidebar = ({ returnFocus = false } = {}) => {
    if (desktopMedia.matches) return;
    syncSidebar(false);
    if (returnFocus) menuToggle?.focus();
  };

  const openSidebar = () => {
    if (desktopMedia.matches) return;
    syncSidebar(true);
    sidebar?.querySelector("a[aria-current='page'], button")?.focus();
  };

  menuToggle?.addEventListener("click", () => {
    if (sidebarIsOpen()) closeSidebar({ returnFocus: true });
    else openSidebar();
  }, { signal });

  sidebarCloseButtons.forEach((button) => {
    button.addEventListener("click", () => closeSidebar({ returnFocus: true }), { signal });
  });

  sidebarBackdrop?.addEventListener("click", () => closeSidebar({ returnFocus: true }), { signal });

  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sidebarIsOpen()) closeSidebar({ returnFocus: true });
  }, { signal });

  sidebar?.querySelectorAll("a.dashboard-nav__item").forEach((link) => {
    link.addEventListener("click", () => {
      sidebar.querySelectorAll(".dashboard-nav__item").forEach((item) => {
        const isCurrent = item === link;
        item.classList.toggle("is-active", isCurrent);
        item.toggleAttribute("aria-current", isCurrent);
      });
      closeSidebar();
    }, { signal });
  });

  desktopMedia.addEventListener("change", () => syncSidebar(false), { signal });
  syncSidebar(false);

  const tabs = mountTabs(root);
  const dialogs = mountDialogs(root);
  const toastController = mountToast(root.querySelector("#dashboard-toast"));
  const showToast = (message) => toastController?.show(message);

  const periodButtons = [...root.querySelectorAll("[data-dashboard-period]")];
  const chartPeriod = root.querySelector("#dashboard-chart-period");
  periodButtons.forEach((button) => {
    button.addEventListener("click", () => {
      periodButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      if (chartPeriod) chartPeriod.textContent = `Showing revenue for the last ${button.dataset.dashboardPeriod}`;
    }, { signal });
  });

  const tableFilter = root.querySelector("#dashboard-table-filter");
  const tableRows = [...root.querySelectorAll("[data-dashboard-row]")];
  const tableEmptyState = root.querySelector("#dashboard-table-empty");
  const tableStatus = root.querySelector("#dashboard-table-status");

  tableFilter?.addEventListener("input", () => {
    const query = tableFilter.value.trim().toLocaleLowerCase();
    let visibleRows = 0;

    tableRows.forEach((row) => {
      const matches = row.textContent.toLocaleLowerCase().includes(query);
      row.hidden = !matches;
      if (matches) visibleRows += 1;
    });

    if (tableEmptyState) tableEmptyState.hidden = visibleRows !== 0;
    if (tableStatus) {
      tableStatus.textContent = visibleRows === 1 ? "1 project shown" : `${visibleRows} projects shown`;
    }
  }, { signal });

  root.querySelectorAll("[data-dashboard-feedback]").forEach((button) => {
    button.addEventListener("click", () => showToast(button.dataset.dashboardFeedback), { signal });
  });

  const quickActionDialog = root.querySelector("#dashboard-quick-action");
  quickActionDialog?.querySelectorAll("[data-dashboard-quick-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.dashboardQuickAction;
      quickActionDialog.close();
      showToast(`${action} is ready to be configured.`);
    }, { signal });
  });

  const instance = {
    destroy() {
      abortController.abort();
      tabs?.destroy();
      dialogs?.destroy();
      toastController?.destroy();
      body.classList.toggle("dashboard-menu-open", hadOpenBodyClass);
      if (menuToggle) {
        if (originalMenuExpanded === null) menuToggle.removeAttribute("aria-expanded");
        else menuToggle.setAttribute("aria-expanded", originalMenuExpanded);
      }
      if (sidebar) {
        if (originalSidebarHidden === null) sidebar.removeAttribute("aria-hidden");
        else sidebar.setAttribute("aria-hidden", originalSidebarHidden);
        sidebar.toggleAttribute("inert", originalSidebarInert);
      }
      instances.delete(root);
    },
  };

  instances.set(root, instance);
  return instance;
}

document.querySelectorAll(".dashboard").forEach((root) => mountDashboard(root));
