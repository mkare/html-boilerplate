import { mountStickyHeader } from "@js/components/sticky-header";

const instances = new WeakMap();
const COLOR_SCHEME_KEY = "interface-kit:color-scheme:v1";
let generatedNavigationId = 0;

const isPreference = (value) => value === "light" || value === "dark" || value === "system";
const normalizePath = (pathname) => pathname.length > 1 ? pathname.replace(/\/+$/, "") : "/";

function getPreference(root) {
  const preference = root.dataset.colorSchemePreference;
  return isPreference(preference) ? preference : "system";
}

function resolveScheme(preference, view = globalThis.window) {
  if (preference !== "system") return preference;

  try {
    return view.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyScheme(root, preference) {
  const resolved = resolveScheme(preference, root.ownerDocument?.defaultView || globalThis.window);
  root.dataset.colorSchemePreference = preference;
  root.dataset.colorScheme = resolved;
  root.dataset.bsTheme = resolved;
  return resolved;
}

export function mountHeader(root = document, options = {}) {
  const header = root.matches?.("[data-component='site-header']")
    ? root
    : root.querySelector?.("[data-component='site-header']");
  if (!header) return { destroy() {} };

  const existing = instances.get(header);
  if (existing) return existing;

  const navigation = header.querySelector(".nav-list");
  const menuToggle = header.querySelector(".nav-toggle");
  const themeToggle = header.querySelector(".theme-toggle");
  const html = header.ownerDocument.documentElement;
  const view = header.ownerDocument.defaultView || globalThis.window;
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const cleanups = [];
  let stickyController = null;
  let destroyed = false;

  const originalNavigationId = navigation?.id ?? "";
  if (navigation) {
    const duplicateIds = originalNavigationId
      ? [...header.ownerDocument.querySelectorAll("[id]")].filter((element) => element.id === originalNavigationId).length > 1
      : true;
    if (duplicateIds) {
      let nextId;
      do {
        generatedNavigationId += 1;
        nextId = `primary-navigation-${generatedNavigationId}`;
      } while ([...header.ownerDocument.querySelectorAll("[id]")].some((element) => element.id === nextId));
      navigation.id = nextId;
      menuToggle?.setAttribute("aria-controls", nextId);
    }
  }

  const listen = (target, type, listener, listenerOptions = {}) => {
    if (!target) return;
    let registeredWithSignal = false;
    if (controller) {
      try {
        target.addEventListener(type, listener, { ...listenerOptions, signal: controller.signal });
        registeredWithSignal = true;
      } catch {
        // Older browsers may not support AbortSignal in addEventListener.
      }
    }
    if (!registeredWithSignal) target.addEventListener(type, listener, listenerOptions);
    cleanups.push(() => target.removeEventListener(type, listener, listenerOptions));
  };

  const setMenuOpen = (isOpen) => {
    header.classList.toggle("menu-open", isOpen);
    menuToggle?.setAttribute("aria-expanded", String(isOpen));
  };

  const markCurrentPage = () => {
    const currentPath = normalizePath(view.location.pathname);
    navigation?.querySelectorAll("a[href]").forEach((link) => {
      try {
        const linkPath = normalizePath(new URL(link.href, view.location.href).pathname);
        if (linkPath === currentPath) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      } catch {
        link.removeAttribute("aria-current");
      }
    });
  };

  const syncThemeToggle = () => {
    if (!themeToggle) return;
    const isDark = html.dataset.colorScheme === "dark";
    const label = isDark ? "Use light theme" : "Use dark theme";
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute("aria-label", label);
    themeToggle.setAttribute("title", label);
  };

  const choosePreference = (preference, persist = false) => {
    const resolved = applyScheme(html, preference);
    syncThemeToggle();
    if (!persist) return;

    try {
      const storage = view.localStorage;
      storage.setItem(COLOR_SCHEME_KEY, preference);
      storage.removeItem("theme");
    } catch {
      // Theme controls stay usable when browser storage is disabled.
    }

    return resolved;
  };

  markCurrentPage();
  setMenuOpen(false);

  if (navigation && menuToggle) {
    listen(menuToggle, "click", () => setMenuOpen(!header.classList.contains("menu-open")));
    listen(navigation, "click", (event) => {
      if (event.target.closest?.("a[href]")) setMenuOpen(false);
    });
    listen(header.ownerDocument, "keydown", (event) => {
      if (event.key !== "Escape" || !header.classList.contains("menu-open")) return;
      setMenuOpen(false);
      menuToggle.focus();
    });
    listen(header.ownerDocument, "click", (event) => {
      if (!header.classList.contains("menu-open") || header.contains(event.target)) return;
      setMenuOpen(false);
    });
  }

  listen(themeToggle, "click", () => {
    const next = html.dataset.colorScheme === "dark" ? "light" : "dark";
    choosePreference(next, true);
  });

  const onStorage = (event) => {
    if (event.key !== COLOR_SCHEME_KEY && event.key !== "theme") return;
    let candidate = event.newValue;
    if (event.key === "theme" && candidate === null) {
      try {
        candidate = view.localStorage.getItem(COLOR_SCHEME_KEY);
      } catch {
        candidate = null;
      }
    }
    const preference = isPreference(candidate)
      ? candidate
      : (candidate === "dark" || candidate === "light" ? candidate : "system");
    choosePreference(preference);
  };
  listen(view, "storage", onStorage);

  let systemPreference = null;
  try {
    systemPreference = view.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (getPreference(html) === "system") {
        applyScheme(html, "system");
        syncThemeToggle();
      }
    };
    if (systemPreference.addEventListener) listen(systemPreference, "change", onSystemChange);
    else if (systemPreference.addListener) {
      systemPreference.addListener(onSystemChange);
      cleanups.push(() => systemPreference.removeListener(onSystemChange));
    }
  } catch {
    systemPreference = null;
  }

  // Older documents may still include the public body.theme-dark class.
  if (header.ownerDocument.body?.classList.contains("theme-dark")) {
    if (getPreference(html) === "system") choosePreference("dark", true);
    header.ownerDocument.body.classList.remove("theme-dark");
  } else applyScheme(html, getPreference(html));
  syncThemeToggle();

  if (options.sticky !== false) stickyController = mountStickyHeader(header, options);

  header.dataset.shellReady = "true";

  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      controller?.abort();
      cleanups.forEach((cleanup) => cleanup());
      stickyController?.destroy();
      setMenuOpen(false);
      delete header.dataset.shellReady;
      instances.delete(header);
    },
  };

  instances.set(header, instance);
  return instance;
}

export default function Header(root = document, options = {}) {
  return mountHeader(root, options);
}
