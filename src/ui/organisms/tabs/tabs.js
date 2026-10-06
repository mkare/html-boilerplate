const instances = new WeakMap();
let instanceNumber = 0;

const setAttribute = (element, name, value) => {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
};

/** Mount accessible, automatically activated tabs under a document or element root. */
export function mountTabs(root = document, { idPrefix } = {}) {
  if (!root || instances.has(root)) return instances.get(root) || null;

  const abortController = new AbortController();
  const { signal } = abortController;
  const saved = [];
  const tabLists = [...root.querySelectorAll('[role="tablist"]')];
  instanceNumber += 1;

  tabLists.forEach((tabList, listIndex) => {
    const tabs = [...tabList.querySelectorAll('[role="tab"]')].filter((tab) => !tab.disabled);
    const pairs = tabs.map((tab, tabIndex) => {
      const panelId = tab.dataset.tab?.trim() || tab.getAttribute("aria-controls");
      const panel = panelId ? tab.ownerDocument.getElementById(panelId) : null;
      if (!panel) return null;

      const prefix = idPrefix || root.dataset?.idPrefix || `tabs-${instanceNumber}-${listIndex + 1}`;
      if (!tab.id) {
        saved.push([tab, "id", tab.getAttribute("id")]);
        tab.id = `${prefix}-tab-${tabIndex + 1}`;
      }
      if (!panel.id) {
        saved.push([panel, "id", panel.getAttribute("id")]);
        panel.id = `${prefix}-panel-${tabIndex + 1}`;
      }

      [
        [tab, "aria-controls"],
        [tab, "aria-selected"],
        [tab, "tabindex"],
        [panel, "role"],
        [panel, "aria-labelledby"],
      ].forEach(([element, name]) => saved.push([element, name, element.getAttribute(name)]));
      saved.push([panel, "hidden", panel.hidden ? "" : null]);
      saved.push([tab, "class:is-active", tab.classList.contains("is-active")]);

      tab.setAttribute("aria-controls", panel.id);
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tab.id);
      return { tab, panel };
    }).filter(Boolean);

    if (!pairs.length) return;

    const activate = (selected, focus = false) => {
      pairs.forEach((pair) => {
        const active = pair === selected;
        pair.tab.setAttribute("aria-selected", String(active));
        pair.tab.tabIndex = active ? 0 : -1;
        pair.tab.classList.toggle("is-active", active);
        pair.panel.hidden = !active;
      });
      if (focus) selected.tab.focus({ preventScroll: true });
    };

    const selected = pairs.find(({ tab }) => tab.getAttribute("aria-selected") === "true") || pairs[0];
    activate(selected);

    const activateFromLocation = () => {
      let targetId = "";
      try {
        targetId = decodeURIComponent(root.ownerDocument?.defaultView?.location.hash.slice(1) || window.location.hash.slice(1));
      } catch {
        return;
      }
      const target = pairs.find(({ panel }) => panel.id === targetId);
      if (target) activate(target);
    };
    activateFromLocation();
    const view = root.ownerDocument?.defaultView || window;
    view.addEventListener("hashchange", activateFromLocation, { signal });

    pairs.forEach((pair) => {
      pair.tab.addEventListener("click", () => activate(pair), { signal });
      pair.tab.addEventListener("keydown", (event) => {
        const vertical = tabList.getAttribute("aria-orientation") === "vertical";
        const forward = vertical ? "ArrowDown" : "ArrowRight";
        const backward = vertical ? "ArrowUp" : "ArrowLeft";
        const current = pairs.indexOf(pair);
        let target = null;

        if (event.key === "Home") target = 0;
        else if (event.key === "End") target = pairs.length - 1;
        else if (event.key === forward) target = (current + 1) % pairs.length;
        else if (event.key === backward) target = (current - 1 + pairs.length) % pairs.length;
        if (target === null) return;

        event.preventDefault();
        activate(pairs[target], true);
      }, { signal });
    });
  });

  const instance = {
    destroy() {
      abortController.abort();
      saved.reverse().forEach(([element, name, value]) => {
        if (name === "hidden") element.hidden = value !== null;
        else if (name === "class:is-active") element.classList.toggle("is-active", value);
        else setAttribute(element, name, value);
      });
      instances.delete(root);
    },
  };
  instances.set(root, instance);
  return instance;
}
