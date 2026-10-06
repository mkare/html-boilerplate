#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const runtimeOnly = process.argv.includes('--runtime-only');

class EventNode {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatchEvent(type, event = {}) {
    event.target ||= this;
    event.currentTarget = this;
    for (const listener of [...(this.listeners.get(type) || [])]) listener(event);
  }
  listenerCount(type) { return this.listeners.get(type)?.size || 0; }
}

class ClassList {
  constructor() { this.values = new Set(); }
  contains(value) { return this.values.has(value); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  toggle(value, force) {
    const next = force === undefined ? !this.contains(value) : Boolean(force);
    if (next) this.add(value); else this.remove(value);
    return next;
  }
}

class FakeElement extends EventNode {
  constructor(document, { id = '', selector = '' } = {}) {
    super();
    this.ownerDocument = document;
    this.id = id;
    this.selector = selector;
    this.dataset = {};
    this.attributes = new Map();
    this.classList = new ClassList();
    this.children = [];
    this.textContent = '';
    this.focused = false;
    if (id) this.attributes.set('id', id);
  }
  matches(selector) {
    return (selector === "[data-component='site-header']" && this.selector === 'header')
      || (selector === "[data-component='site-footer']" && this.selector === 'footer');
  }
  querySelector(selector) { return this.children.find((child) => child.selector === selector) || null; }
  querySelectorAll(selector) {
    if (selector === 'a[href]') return this.children.filter((child) => child.selector === 'link');
    return [];
  }
  setAttribute(name, value) {
    const text = String(value);
    this.attributes.set(name, text);
    if (name === 'id') this.id = text;
  }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'id') this.id = '';
  }
  remove() { this.removed = true; }
  closest(selector) { return selector === 'a[href]' && this.selector === 'link' ? this : null; }
  contains(target) { return target === this || this.children.includes(target) || this.children.some((child) => child.children.includes(target)); }
  focus() { this.focused = true; }
}

class InteractiveNode {
  constructor({ tagName = 'div', id = '', attributes = {}, dataset = {} } = {}) {
    this.tagName = tagName.toLowerCase();
    this.id = id;
    this.dataset = { ...dataset };
    this.attributes = new Map(Object.entries(attributes));
    if (id) this.attributes.set('id', id);
    this.children = [];
    this.listeners = new Map();
    this.queryLists = new Map();
    this.querySingles = new Map();
    this.hidden = false;
    this.disabled = false;
    this.tabIndex = -1;
    this.textContent = '';
    this.focused = false;
    const classes = new Set();
    this.classList = {
      contains: (name) => classes.has(name),
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      toggle: (name, force) => {
        const next = force === undefined ? !classes.has(name) : Boolean(force);
        if (next) classes.add(name); else classes.delete(name);
        return next;
      },
    };
  }
  addEventListener(type, callback, options = {}) {
    const signal = typeof options === 'object' ? options.signal : null;
    if (signal?.aborted) return;
    const listeners = this.listeners.get(type) || new Map();
    if (listeners.has(callback)) return;
    const entry = { callback, signal, abort: null };
    if (signal) {
      entry.abort = () => this.removeEventListener(type, callback);
      signal.addEventListener('abort', entry.abort, { once: true });
    }
    listeners.set(callback, entry);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type, callback) {
    const listeners = this.listeners.get(type);
    const entry = listeners?.get(callback);
    if (!entry) return;
    if (entry.abort) entry.signal.removeEventListener('abort', entry.abort);
    listeners.delete(callback);
  }
  dispatch(type, event = {}) {
    event.target ||= this;
    event.currentTarget = this;
    event.preventDefault ||= () => { event.defaultPrevented = true; };
    for (const entry of [...(this.listeners.get(type)?.values() || [])]) entry.callback.call(this, event);
    return event;
  }
  async dispatchAsync(type, event = {}) {
    event.target ||= this;
    event.currentTarget = this;
    event.preventDefault ||= () => { event.defaultPrevented = true; };
    const pending = [...(this.listeners.get(type)?.values() || [])]
      .map((entry) => entry.callback.call(this, event));
    await Promise.all(pending);
    return event;
  }
  listenerCount(type) { return this.listeners.get(type)?.size || 0; }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'id') this.id = String(value);
  }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'id') this.id = '';
  }
  matches(selector) {
    return selector.split(',').some((part) => {
      const rule = part.trim();
      return (rule === 'button' && this.tagName === 'button')
        || (rule === '[role=button]' && this.getAttribute('role') === 'button');
    });
  }
  querySelectorAll(selector) { return this.queryLists.get(selector) || []; }
  querySelector(selector) { return this.querySingles.get(selector) || null; }
  focus() { this.focused = true; }
}

function createFixture({ headers = 1, storageDenied = false, scheme = 'light', preference = 'system' } = {}) {
  const document = new EventNode();
  document.elements = [];
  document.documentElement = new FakeElement(document);
  document.documentElement.lang = 'en';
  document.documentElement.dataset.colorScheme = scheme;
  document.documentElement.dataset.colorSchemePreference = preference;
  document.documentElement.dataset.bsTheme = scheme;
  document.body = new FakeElement(document);
  document.main = { before(element) { element.inserted = true; this.sentinel = element; }, querySelector() { return null; } };
  document.querySelector = (selector) => selector === '#siteMain' ? document.main : null;
  document.querySelectorAll = (selector) => selector === '[id]'
    ? document.elements.filter((element) => Boolean(element.id))
    : [];
  document.createElement = (tagName) => new FakeElement(document, { selector: tagName });

  const media = new EventNode();
  media.matches = scheme === 'dark';
  const storage = new Map();
  const view = new EventNode();
  view.location = { pathname: '/about/', href: 'https://example.test/about/' };
  view.matchMedia = () => media;
  view.observers = [];
  view.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; this.disconnected = false; view.observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  };
  Object.defineProperty(view, 'localStorage', {
    get() {
      if (storageDenied) throw new Error('Storage is blocked by browser policy.');
      return {
        getItem(key) { return storage.get(key) ?? null; },
        setItem(key, value) { storage.set(key, String(value)); },
        removeItem(key) { storage.delete(key); },
      };
    },
  });
  document.defaultView = view;
  document.documentElement.ownerDocument = document;
  document.body.ownerDocument = document;

  const roots = [];
  for (let index = 0; index < headers; index += 1) {
    const header = new FakeElement(document, { selector: 'header' });
    const navigation = new FakeElement(document, { id: 'primary-navigation', selector: '.nav-list' });
    const toggle = new FakeElement(document, { selector: '.nav-toggle' });
    toggle.setAttribute('aria-controls', 'primary-navigation');
    toggle.setAttribute('aria-expanded', 'false');
    const theme = new FakeElement(document, { selector: '.theme-toggle' });
    const link = new FakeElement(document, { selector: 'link' });
    link.href = 'https://example.test/about/';
    link.setAttribute('href', link.href);
    navigation.children.push(link);
    header.children.push(navigation, toggle, theme);
    header.navigation = navigation;
    header.menuToggle = toggle;
    header.themeToggle = theme;
    header.ownerDocument = document;
    document.elements.push(navigation);
    roots.push(header);
  }

  return { document, media, roots, storage };
}

function loadHeaderController() {
  const source = read('src/js/components/header.js')
    .replace(/^import \{ mountStickyHeader \} from "@js\/components\/sticky-header";\s*/m, '')
    .replace('export function mountHeader', 'function mountHeader')
    .replace('export default function Header', 'function Header');
  const context = {
    AbortController,
    URL,
    console,
    mountStickyHeader: () => ({ destroy() {} }),
  };
  vm.runInNewContext(`${source}\nglobalThis.__api = { mountHeader };`, context, { filename: 'src/js/components/header.js' });
  return context.__api;
}

function loadStickyController() {
  const source = read('src/js/components/sticky-header.js')
    .replace('export function mountStickyHeader', 'function mountStickyHeader')
    .replace('export default mountStickyHeader;', '');
  const context = {};
  vm.runInNewContext(`${source}\nglobalThis.__api = { mountStickyHeader };`, context, { filename: 'src/js/components/sticky-header.js' });
  return context.__api;
}

function loadFooterController() {
  const source = read('src/js/components/footer.js')
    .replace('export function mountFooter', 'function mountFooter')
    .replace('export default function Footer', 'function Footer');
  const context = { WeakMap, Date };
  vm.runInNewContext(`${source}\nglobalThis.__api = { mountFooter };`, context, { filename: 'src/js/components/footer.js' });
  return context.__api;
}

function verifyControllerLifecycle() {
  const { mountHeader } = loadHeaderController();
  const blocked = createFixture({ storageDenied: true, preference: 'system', scheme: 'light' });
  const deniedController = mountHeader(blocked.roots[0]);
  assert.equal(blocked.roots[0].dataset.shellReady, 'true');
  assert.equal(blocked.roots[0].themeToggle.getAttribute('aria-pressed'), 'false');
  blocked.roots[0].themeToggle.dispatchEvent('click');
  assert.equal(blocked.document.documentElement.dataset.colorScheme, 'dark', 'theme remains usable when storage access throws');
  assert.equal(blocked.document.documentElement.dataset.colorSchemePreference, 'dark');
  deniedController.destroy();

  const changedBeforeMount = createFixture({ preference: 'system', scheme: 'light' });
  changedBeforeMount.media.matches = true;
  const lateMountController = mountHeader(changedBeforeMount.roots[0]);
  assert.equal(changedBeforeMount.document.documentElement.dataset.colorScheme, 'dark', 'mount reconciles an OS change that happened after first paint');
  lateMountController.destroy();

  const system = createFixture({ preference: 'system', scheme: 'light' });
  const systemController = mountHeader(system.roots[0]);
  assert.equal(system.document.documentElement.dataset.colorScheme, 'light');
  system.media.matches = true;
  system.media.dispatchEvent('change', { matches: true });
  assert.equal(system.document.documentElement.dataset.colorScheme, 'dark', 'system preference follows OS changes');
  system.roots[0].themeToggle.dispatchEvent('click');
  assert.equal(system.document.documentElement.dataset.colorSchemePreference, 'light', 'the theme toggle creates an explicit preference');
  system.media.matches = true;
  system.media.dispatchEvent('change', { matches: true });
  assert.equal(system.document.documentElement.dataset.colorScheme, 'light', 'explicit preference survives later OS changes');
  systemController.destroy();
  assert.equal(system.media.listenerCount('change'), 0, 'destroy removes OS preference listeners');

  const multiple = createFixture({ headers: 2 });
  const first = mountHeader(multiple.roots[0]);
  assert.equal(mountHeader(multiple.roots[0]), first, 'mounting the same header twice returns the same controller');
  const second = mountHeader(multiple.roots[1]);
  assert.notEqual(multiple.roots[0].navigation.id, multiple.roots[1].navigation.id, 'multiple headers get unique navigation IDs');
  assert.equal(multiple.roots[0].menuToggle.getAttribute('aria-controls'), multiple.roots[0].navigation.id);
  assert.equal(multiple.roots[1].menuToggle.getAttribute('aria-controls'), multiple.roots[1].navigation.id);
  multiple.roots[0].menuToggle.dispatchEvent('click');
  assert.equal(multiple.roots[0].classList.contains('menu-open'), true);
  multiple.roots[0].navigation.dispatchEvent('click', { target: multiple.roots[0].navigation.children[0] });
  assert.equal(multiple.roots[0].classList.contains('menu-open'), false, 'following a menu link closes the menu');
  multiple.roots[0].menuToggle.dispatchEvent('click');
  multiple.document.dispatchEvent('keydown', { key: 'Escape' });
  assert.equal(multiple.roots[0].classList.contains('menu-open'), false, 'Escape closes the menu');
  assert.equal(multiple.roots[0].menuToggle.focused, true, 'Escape returns focus to the menu toggle');
  first.destroy();
  first.destroy();
  assert.equal(multiple.document.listenerCount('keydown'), 1, 'destroy removes the first header listener');
  const remounted = mountHeader(multiple.roots[0]);
  multiple.roots[0].menuToggle.dispatchEvent('click');
  assert.equal(multiple.roots[0].classList.contains('menu-open'), true, 'destroyed headers can be mounted again');
  remounted.destroy();
  second.destroy();

  const sticky = createFixture();
  const { mountStickyHeader } = loadStickyController();
  const stickyController = mountStickyHeader(sticky.roots[0]);
  assert.equal(mountStickyHeader(sticky.roots[0]), stickyController, 'sticky observer mount is idempotent');
  const observer = sticky.document.defaultView.observers[0];
  observer.callback([{ isIntersecting: false }]);
  assert.equal(sticky.roots[0].classList.contains('active'), true, 'sticky observer reflects scroll state');
  stickyController.destroy();
  assert.equal(observer.disconnected, true);
  assert.equal(sticky.document.main.sentinel.removed, true, 'sticky cleanup removes its sentinel');
  assert.equal(sticky.roots[0].classList.contains('active'), false);

  const { mountFooter } = loadFooterController();
  const footerA = new FakeElement(null, { selector: 'footer' });
  const yearA = new FakeElement(null, { selector: '[data-current-year]' });
  yearA.textContent = 'Original A';
  footerA.children.push(yearA);
  const footerB = new FakeElement(null, { selector: 'footer' });
  const yearB = new FakeElement(null, { selector: '[data-current-year]' });
  yearB.textContent = 'Original B';
  footerB.children.push(yearB);
  const footerControllerA = mountFooter(footerA);
  assert.equal(mountFooter(footerA), footerControllerA, 'footer mount is idempotent per root');
  const footerControllerB = mountFooter(footerB);
  assert.equal(yearA.textContent, yearB.textContent, 'multiple footers get the same current year independently');
  footerControllerA.destroy();
  assert.equal(yearA.textContent, 'Original A', 'footer destroy restores its original year text');
  const remountedFooterA = mountFooter(footerA);
  assert.notEqual(remountedFooterA, footerControllerA, 'footer can be remounted after destroy');
  remountedFooterA.destroy();
  footerControllerB.destroy();
}

function verifyTabsLifecycle() {
  const source = read('src/ui/organisms/tabs/tabs.js')
    .replace('export function mountTabs', 'function mountTabs')
    .replace('export default mountTabs;', '');
  const context = { AbortController, window: { location: { hash: '' } } };
  vm.runInNewContext(`${source}\nglobalThis.__api = { mountTabs };`, context, { filename: 'src/ui/organisms/tabs/tabs.js' });
  const { mountTabs } = context.__api;

  const createTabsRoot = () => {
    const view = new InteractiveNode();
    view.location = { hash: '' };
    const panels = [];
    const document = {
      defaultView: view,
      getElementById: (id) => panels.find((panel) => panel.id === id) || null,
    };
    const root = new InteractiveNode({ dataset: { idPrefix: `fixture-tabs-${++createTabsRoot.index}` } });
    root.ownerDocument = document;
    const list = new InteractiveNode({ attributes: { role: 'tablist' } });
    const tabs = ['one', 'two'].map((name, index) => new InteractiveNode({
      tagName: 'button',
      attributes: { role: 'tab', 'aria-selected': String(index === 0) },
      dataset: { tab: `${name}-panel` },
    }));
    const tabPanels = ['one', 'two'].map((name) => new InteractiveNode({
      id: `${name}-panel`,
      attributes: { 'data-original': name },
    }));
    tabs.forEach((tab) => { tab.ownerDocument = document; });
    tabPanels.forEach((panel) => { panel.ownerDocument = document; });
    tabPanels.forEach((panel, index) => { panel.hidden = index !== 0; });
    list.queryLists.set('[role="tab"]', tabs);
    root.queryLists.set('[role="tablist"]', [list]);
    panels.push(...tabPanels);
    return { root, view, tabs, tabPanels };
  };
  createTabsRoot.index = 0;

  const first = createTabsRoot();
  const second = createTabsRoot();
  const firstController = mountTabs(first.root);
  assert.equal(mountTabs(first.root), firstController, 'tabs mount is idempotent per root');
  const secondController = mountTabs(second.root);
  first.tabs[0].dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(first.tabs[1].getAttribute('aria-selected'), 'true', 'ArrowRight automatically activates the next tab');
  assert.equal(first.tabs[1].focused, true, 'keyboard activation moves focus to the selected tab');
  assert.equal(first.tabs[1].tabIndex, 0);
  first.view.location.hash = '#one-panel';
  first.view.dispatch('hashchange');
  assert.equal(first.tabs[0].getAttribute('aria-selected'), 'true', 'a matching hash activates its tab panel');
  assert.equal(first.tabPanels[1].hidden, true);
  firstController.destroy();
  assert.equal(first.view.listenerCount('hashchange'), 0, 'destroy removes the hashchange listener');
  assert.equal(first.tabs[0].listenerCount('keydown'), 0, 'destroy removes keyboard listeners');
  assert.equal(first.tabs[0].getAttribute('id'), null, 'destroy restores generated IDs');
  assert.equal(first.tabs[0].getAttribute('aria-controls'), null, 'destroy restores original ARIA attributes');
  assert.equal(first.tabPanels[0].getAttribute('role'), null, 'destroy restores panel roles');
  const remounted = mountTabs(first.root);
  first.tabs[1].dispatch('click');
  assert.equal(first.tabs[1].getAttribute('aria-selected'), 'true', 'destroyed tabs can be mounted again');
  remounted.destroy();
  secondController.destroy();
}

async function verifyDialogLifecycle() {
  const source = read('src/ui/organisms/dialog/dialog.js')
    .replace('export function mountDialogs', 'function mountDialogs')
    .replace('export default mountDialogs;', '');
  const context = {
    AbortController,
    CSS: { escape: (value) => String(value) },
    queueMicrotask,
    setTimeout: (callback) => { queueMicrotask(callback); return 1; },
  };
  vm.runInNewContext(`${source}\nglobalThis.__api = { mountDialogs };`, context, { filename: 'src/ui/organisms/dialog/dialog.js' });
  const { mountDialogs } = context.__api;

  const root = new InteractiveNode();
  const dialogs = [];
  const openers = [];
  for (let index = 1; index <= 2; index += 1) {
    const id = `dialog-${index}`;
    const dialog = new InteractiveNode({ tagName: 'dialog', id });
    const initialFocus = new InteractiveNode({ tagName: 'button' });
    dialog.querySingles.set('[data-dialog-initial-focus], input:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex=\'-1\'])', initialFocus);
    dialog.showModal = () => { dialog.open = true; };
    dialog.close = () => {
      if (!dialog.open) return;
      dialog.open = false;
      dialog.dispatch('close');
    };
    const opener = new InteractiveNode({ tagName: 'button', attributes: { 'aria-controls': id } });
    root.queryLists.set(`dialog[data-ui-dialog]${index === 1 ? '' : `#${id}`}`, [dialog]);
    root.queryLists.set(`[aria-controls="${id}"]`, [opener]);
    dialogs.push({ dialog, initialFocus });
    openers.push(opener);
  }
  // The selector is identical for every dialog; expose both elements together.
  root.queryLists.set('dialog[data-ui-dialog]', dialogs.map(({ dialog }) => dialog));
  const closeCalls = [];
  const controller = mountDialogs(root, { onClose: (dialog, opener) => closeCalls.push([dialog, opener]) });
  assert.equal(mountDialogs(root), controller, 'dialog mount is idempotent per root');
  assert.equal(openers[0].getAttribute('aria-haspopup'), 'dialog');
  openers[0].dispatch('click');
  await Promise.resolve();
  assert.equal(dialogs[0].dialog.open, true, 'the opener opens its native dialog');
  assert.equal(dialogs[0].initialFocus.focused, true, 'opening moves focus into the dialog');
  dialogs[0].dialog.close();
  await Promise.resolve();
  assert.deepEqual(closeCalls, [[dialogs[0].dialog, openers[0]]], 'close callback receives its dialog and opener');
  assert.equal(openers[0].focused, true, 'closing restores focus to the opener');
  openers[1].dispatch('click');
  assert.equal(dialogs[1].dialog.open, true, 'a second dialog instance opens independently');
  controller.destroy();
  assert.equal(dialogs[1].dialog.open, false, 'destroy closes an open dialog');
  assert.equal(dialogs[0].dialog.listenerCount('close'), 0, 'destroy removes dialog listeners');
  assert.equal(openers[0].listenerCount('click'), 0, 'destroy removes opener listeners');
  assert.equal(openers[0].getAttribute('aria-haspopup'), null, 'destroy restores opener attributes');
  const remounted = mountDialogs(root);
  openers[0].dispatch('click');
  assert.equal(dialogs[0].dialog.open, true, 'dialogs can be remounted after destroy');
  remounted.destroy();
}

function verifyToastLifecycle() {
  const source = read('src/ui/organisms/toast/toast.js')
    .replace('export function mountToast', 'function mountToast')
    .replace('export default mountToast;', '');
  let nextId = 0;
  const timers = new Map();
  const frames = new Map();
  const clock = {
    setTimeout(callback, delay) { const id = ++nextId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(callback) { const id = ++nextId; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  const context = { window: clock };
  vm.runInNewContext(`${source}\nglobalThis.__api = { mountToast };`, context, { filename: 'src/ui/organisms/toast/toast.js' });
  const { mountToast } = context.__api;
  const firstRoot = new InteractiveNode();
  const secondRoot = new InteractiveNode();
  firstRoot.hidden = secondRoot.hidden = true;
  const first = mountToast(firstRoot);
  assert.equal(mountToast(firstRoot), first, 'toast mount is idempotent per root');
  const second = mountToast(secondRoot);
  first.show('Old notice', { duration: 50 });
  first.show('Current notice', { duration: 50, state: 'status' });
  second.show('Independent notice', { duration: 80 });
  assert.equal(frames.size, 2, 'each toast instance owns its animation frame');
  const frameIds = [...frames.keys()];
  frames.get(frameIds[0])();
  frames.delete(frameIds[0]);
  frames.get(frameIds[1])();
  frames.delete(frameIds[1]);
  assert.equal(firstRoot.textContent, 'Current notice', 'a replacement notice cancels stale content');
  assert.equal(secondRoot.textContent, 'Independent notice', 'a second toast keeps independent content');
  assert.equal(timers.size, 2, 'each toast has its own dismiss timer');
  first.destroy();
  assert.equal(timers.size, 1, 'destroy cancels the toast instance timers');
  assert.equal(firstRoot.hidden, true);
  assert.equal(firstRoot.textContent, '');
  const remounted = mountToast(firstRoot);
  remounted.show('After remount', { duration: 50 });
  const frameId = [...frames.keys()][0];
  frames.get(frameId)();
  frames.delete(frameId);
  assert.equal(firstRoot.textContent, 'After remount', 'toast can be mounted and used again');
  remounted.destroy();
  second.destroy();
  assert.equal(timers.size, 0, 'destroying all toasts leaves no timers');
  assert.equal(frames.size, 0, 'destroying all toasts leaves no animation frames');
}

async function verifySharedUiLifecycles() {
  verifyTabsLifecycle();
  await verifyDialogLifecycle();
  verifyToastLifecycle();
  await verifyAuthFallbackLifecycle();
}

async function verifyAuthFallbackLifecycle() {
  const source = read('src/features/auth/form-controller.js')
    .replace('export const createDemoAuthAdapter', 'const createDemoAuthAdapter')
    .replace('export const createFetchAuthAdapter', 'const createFetchAuthAdapter')
    .replace('export function mountAuthForm', 'function mountAuthForm');
  let fetchCalls = 0;
  let fetchImpl = () => { throw new Error('The demo adapter must never fetch.'); };
  class MockFormData {
    constructor(form) { this.form = form; }
    entries() { return Object.entries(this.form.values || {})[Symbol.iterator](); }
  }
  const context = {
    AbortController,
    HTMLElement: InteractiveNode,
    HTMLInputElement: InteractiveNode,
    FormData: MockFormData,
    CSS: { escape: (value) => String(value) },
    fetch: (...args) => { fetchCalls += 1; return fetchImpl(...args); },
  };
  vm.runInNewContext(`${source}\nglobalThis.__api = { createDemoAuthAdapter, createFetchAuthAdapter, mountAuthForm };`, context, { filename: 'src/features/auth/form-controller.js' });
  const { createDemoAuthAdapter, createFetchAuthAdapter, mountAuthForm } = context.__api;
  assert.throws(() => createFetchAuthAdapter(), /endpoint/i, 'connected auth requires an explicit endpoint');
  const demoResult = await createDemoAuthAdapter('Sign in').submit({ email: 'person@example.test' });
  assert.equal(demoResult.status, 'demo', 'the non-authenticating demo adapter cannot report auth success');
  assert.equal(demoResult.presentation, 'info', 'the demo adapter presents its result as information');

  const form = new InteractiveNode({ tagName: 'form' });
  const fieldset = new InteractiveNode();
  fieldset.disabled = true;
  const feedback = new InteractiveNode();
  const submitButton = new InteractiveNode({ tagName: 'button' });
  const passwordInput = new InteractiveNode({ tagName: 'input', id: 'demo-password', attributes: { name: 'password', type: 'password' } });
  Object.defineProperty(passwordInput, 'type', {
    get() { return this.getAttribute('type'); },
    set(value) { this.setAttribute('type', value); },
  });
  const passwordToggle = new InteractiveNode({
    tagName: 'button',
    attributes: { 'aria-controls': 'demo-password', 'aria-pressed': 'false', 'aria-label': 'Show password' },
  });
  passwordToggle.disabled = true;
  const passwordToggleLabel = new InteractiveNode({ tagName: 'span' });
  passwordToggleLabel.textContent = 'Show';
  passwordToggle.querySingles.set('[data-password-toggle-label]', passwordToggleLabel);
  form.querySingles.set('[data-auth-fields]', fieldset);
  form.querySingles.set('[data-auth-feedback]', feedback);
  form.querySingles.set('[data-submit-button]', submitButton);
  form.querySingles.set('#demo-password', passwordInput);
  form.queryLists.set('[data-matches]', []);
  form.queryLists.set('[data-password-toggle]', [passwordToggle]);
  form.queryLists.set('[data-social-login]', []);
  form.values = { email: 'person@example.test', password: 'not-sent' };
  form.elements = { namedItem: () => null };
  form.reportValidity = () => true;
  assert.equal(passwordInput.type, 'password', 'password starts concealed');
  assert.equal(passwordInput.getAttribute('name'), 'password', 'password keeps its submitted field name');
  assert.equal(passwordToggle.getAttribute('aria-controls'), passwordInput.id, 'password toggle points to its input');
  assert.equal(passwordToggle.getAttribute('aria-pressed'), 'false', 'password toggle starts unpressed');
  assert.equal(passwordToggle.getAttribute('aria-label'), 'Show password', 'password toggle starts with its reveal label');
  const noScriptFieldsetState = fieldset.disabled;
  assert.equal(noScriptFieldsetState, true, 'auth credentials stay disabled without enhancement');
  const controller = mountAuthForm(form, { adapter: createDemoAuthAdapter('Sign in') });
  assert.equal(mountAuthForm(form), controller, 'auth form mount is idempotent');
  assert.equal(fieldset.disabled, false, 'fields are enabled only after the controller mounts');
  assert.equal(passwordToggle.disabled, false, 'mount enables the linked password toggle');
  passwordToggle.dispatch('click');
  assert.equal(passwordInput.type, 'text', 'clicking reveal exposes the password');
  assert.equal(passwordToggle.getAttribute('aria-pressed'), 'true', 'revealed password toggle becomes pressed');
  assert.equal(passwordToggle.getAttribute('aria-label'), 'Hide password', 'revealed password toggle announces its hide action');
  assert.equal(passwordToggleLabel.textContent, 'Hide', 'visible toggle label matches the revealed state');
  passwordToggle.dispatch('click');
  assert.equal(passwordInput.type, 'password', 'clicking hide conceals the password again');
  assert.equal(passwordToggle.getAttribute('aria-pressed'), 'false', 'concealed password toggle returns to unpressed');
  assert.equal(passwordToggle.getAttribute('aria-label'), 'Show password', 'concealed password toggle restores its reveal label');
  assert.equal(passwordToggleLabel.textContent, 'Show', 'visible toggle label restores the reveal action');
  const submitEvent = await form.dispatchAsync('submit');
  assert.equal(submitEvent.defaultPrevented, true, 'demo submission does not navigate or submit natively');
  assert.equal(fetchCalls, 0, 'the demo adapter never sends credentials');
  assert.match(feedback.textContent, /no request was sent to the server/);
  assert.match(feedback.textContent, /no account or session was created/);
  assert.equal(feedback.dataset.state, 'info', 'demo feedback is informational rather than an authentication success state');
  assert.equal(submitButton.disabled, false, 'the submit control leaves its pending state');
  controller.destroy();
  assert.equal(fieldset.disabled, true, 'destroy restores the safe disabled state');
  assert.equal(form.listenerCount('submit'), 0, 'destroy removes form handlers');

  const connectedForm = new InteractiveNode({ tagName: 'form' });
  const connectedFieldset = new InteractiveNode();
  connectedFieldset.disabled = true;
  const connectedFeedback = new InteractiveNode();
  const connectedButton = new InteractiveNode({ tagName: 'button' });
  const email = new InteractiveNode({ tagName: 'input' });
  email.validityMessage = '';
  email.setCustomValidity = (message) => { email.validityMessage = message; };
  connectedForm.querySingles.set('[data-auth-fields]', connectedFieldset);
  connectedForm.querySingles.set('[data-auth-feedback]', connectedFeedback);
  connectedForm.querySingles.set('[data-submit-button]', connectedButton);
  connectedForm.queryLists.set('[data-matches]', []);
  connectedForm.queryLists.set('[data-password-toggle]', []);
  connectedForm.queryLists.set('[data-social-login]', []);
  connectedForm.values = { email: 'person@example.test', password: 'secret' };
  connectedForm.elements = { namedItem: (name) => name === 'email' ? email : null };
  connectedForm.reportValidity = () => true;
  connectedForm.querySelector = (selector) => selector === '[aria-invalid="true"]' && email.getAttribute('aria-invalid') === 'true'
    ? email
    : connectedForm.querySingles.get(selector) || null;
  const fetchAdapter = createFetchAuthAdapter({ endpoint: '/api/auth/session' });
  const fetchController = mountAuthForm(connectedForm, { adapter: fetchAdapter });
  assert.equal(connectedFieldset.disabled, false, 'connected auth fields enable only after the controller mounts');

  let request;
  fetchImpl = async (url, options) => {
    request = { url, ...options };
    return { status: 422, ok: false, async json() { return { fields: { email: 'E-posta adresini kontrol et.' }, message: 'Bilgiler geçersiz.' }; } };
  };
  await connectedForm.dispatchAsync('submit');
  assert.equal(request.url, '/api/auth/session', 'the adapter sends only to the explicitly configured endpoint');
  assert.equal(request.method, 'POST');
  assert.equal(request.credentials, 'same-origin');
  assert.deepEqual(JSON.parse(request.body), connectedForm.values, 'the configured endpoint receives the form payload');
  assert.equal(email.validityMessage, 'E-posta adresini kontrol et.');
  assert.equal(email.getAttribute('aria-invalid'), 'true');
  assert.equal(email.focused, true, 'field errors move focus to the first invalid field');
  assert.equal(connectedFeedback.textContent, 'Bilgiler geçersiz.');
  assert.equal(connectedFeedback.dataset.state, 'error');
  assert.equal(connectedButton.disabled, false, 'field errors clear pending state');

  fetchImpl = async () => ({ status: 200, ok: true, async json() { return { message: 'Oturum açıldı.' }; } });
  await connectedForm.dispatchAsync('submit');
  assert.equal(connectedFeedback.textContent, 'Oturum açıldı.');
  assert.equal(connectedFeedback.dataset.state, 'info');

  fetchImpl = async () => { throw new Error('Sunucuya bağlanılamadı.'); };
  await connectedForm.dispatchAsync('submit');
  assert.equal(connectedFeedback.textContent, 'Sunucuya bağlanılamadı.');
  assert.equal(connectedFeedback.dataset.state, 'error');
  assert.equal(fetchCalls, 3, 'only connected adapter submissions call fetch');
  fetchController.destroy();
  assert.equal(connectedFieldset.disabled, true, 'destroy returns connected credentials to the safe disabled state');
}

function verifySourceOwnership() {
  const documentShell = read('src/layouts/document.pug');
  const layoutAdapter = read('src/layouts/base.pug');
  assert.equal((documentShell.match(/@scss\/core\.scss/g) || []).length, 1);
  assert.equal((documentShell.match(/@scss\/theme\.scss/g) || []).length, 1);
  assert.equal((documentShell.match(/@scss\/layout\.scss/g) || []).length, 1);
  assert.ok(documentShell.indexOf('script.') < documentShell.indexOf('@scss/core.scss'), 'theme initialization precedes stylesheet requests');
  assert.match(layoutAdapter, /extends @layouts\/document\.pug/);

  const pageStyles = [];
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, item.name);
      if (item.isDirectory()) visit(absolute);
      else if (item.isFile() && item.name.endsWith('.scss') && /src[\\/]views|src[\\/]pages/.test(absolute)) pageStyles.push(absolute);
    }
  };
  visit(path.join(root, 'src/views'));
  visit(path.join(root, 'src/pages'));
  for (const file of pageStyles) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /(?:@import|@use)\s+["'][^"']*(?:main|core|theme|layout)\.scss["']/i, `${path.relative(root, file)} must not import shared CSS`);
  }
  const scss = [];
  const scanScss = (directory) => {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, item.name);
      if (item.isDirectory()) scanScss(absolute);
      else if (item.isFile() && item.name.endsWith('.scss')) scss.push(fs.readFileSync(absolute, 'utf8'));
    }
  };
  scanScss(path.join(root, 'src/scss'));
  assert.doesNotMatch(scss.join('\n'), /fonts\.googleapis\.com|@import\s+url\s*\(/i, 'shared SCSS must not request external fonts');
  const themeStyles = read('src/scss/theme.scss');
  assert.match(themeStyles, /html\[data-color-scheme="dark"\]/);
  assert.match(themeStyles, /html\[data-theme="commerce"\]/);
  assert.match(themeStyles, /--bs-body-color:\s*var\(--color-text\)/);
  assert.match(themeStyles, /color-scheme:\s*dark/);
  assert.match(themeStyles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);

  const headerPug = read('src/components/header.pug');
  const footerPug = read('src/components/footer.pug');
  assert.match(headerPug, /each val in primaryNavItems[\s\S]*?route\(val\.pageId\)/);
  assert.match(footerPug, /each val in pageNavItems[\s\S]*?route\(val\.pageId\)/);
  assert.match(headerPug, /route\(homeRoutePageId\)/, 'the header brand link follows the selected package home');
  assert.match(footerPug, /route\(homeRoutePageId\)/, 'the footer brand link follows the selected package home');
  assert.match(headerPug, /typeof demoBrand === "string"/);
  assert.match(footerPug, /typeof demoBrand === "string"/);
  assert.doesNotMatch(headerPug, /href\s*=\s*["']\//, 'header routes must be generated through route()');
  assert.doesNotMatch(footerPug, /href\s*=\s*["']\//, 'footer routes must be generated through route()');
  const headerStyles = read('src/scss/components/header.scss');
  assert.match(headerStyles, /\.nav-list\s*\{[^}]*display:\s*flex/s, 'navigation links stay visible before shell JavaScript mounts');
  assert.match(headerStyles, /\.nav-toggle\s*\{\s*display:\s*none/, 'the menu toggle stays hidden before shell JavaScript mounts');
  assert.match(headerStyles, /\.theme-toggle\s*\{[^}]*width:\s*2\.75rem[^}]*height:\s*2\.75rem/s, 'the theme control meets the 44px project target');
  assert.match(headerStyles, /\.nav-link\s*\{[^}]*min-height:\s*2\.75rem/s, 'primary navigation links meet the 44px project target');
  assert.match(read('src/scss/components/footer.scss'), /min-height:\s*2\.75rem/, 'footer navigation links meet the 44px project target');
  assert.match(documentShell, /try\s*\{[\s\S]*?window\.localStorage[\s\S]*?\}\s*catch\s*\{\}/, 'first-paint storage reads are guarded');

  const themeController = read('src/js/components/header.js');
  assert.match(themeController, /storage\.setItem\(COLOR_SCHEME_KEY/);
  assert.match(themeController, /if \(systemPreference\.addEventListener\) listen\(systemPreference, "change", onSystemChange\)/);
  assert.match(themeController, /Escape/);
  assert.match(read('src/js/components/sticky-header.js'), /observer\?\.disconnect\(\)/);
  assert.match(read('src/js/components/footer.js'), /instances\.delete\(footer\)/);
  const tabsController = read('src/ui/organisms/tabs/tabs.js');
  assert.match(tabsController, /const instances = new WeakMap\(\)/);
  assert.match(tabsController, /ArrowRight|ArrowDown/);
  assert.match(tabsController, /selected\.tab\.focus/);
  assert.match(tabsController, /abortController\.abort\(\)/);
  const dialogController = read('src/ui/organisms/dialog/dialog.js');
  assert.match(dialogController, /const instances = new WeakMap\(\)/);
  assert.match(dialogController, /dialog\.showModal\(\)/);
  assert.match(dialogController, /setTimeout\(\(\) => focusWithoutScroll\(opener\), 0\)/);
  assert.match(dialogController, /abortController\.abort\(\)/);
  const toastController = read('src/ui/organisms/toast/toast.js');
  assert.match(toastController, /const instances = new WeakMap\(\)/);
  assert.match(toastController, /clearTimers\(\)/);
  assert.match(toastController, /generation \+= 1/);
  assert.match(toastController, /window\.clearTimeout/);

  const authController = read('src/features/auth/form-controller.js');
  assert.match(authController, /if \(fieldset\) fieldset\.disabled = false/);
  assert.match(authController, /if \(fieldset\) fieldset\.disabled = true/);
  const demoAuthAdapter = authController.split('/** Create an explicit JSON endpoint adapter')[0];
  assert.doesNotMatch(demoAuthAdapter, /fetch\(|XMLHttpRequest|localStorage/, 'demo auth must not send or store credentials');
  assert.match(demoAuthAdapter, /no request was sent to the server; no account or session was created/);
  for (const file of ['login.pug', 'register.pug', 'forgot-password.pug']) {
    const pug = read(`src/views/auth/${file}`);
    assert.match(pug, /fieldset[^\n]*\(data-auth-fields, disabled\)/, `${file} must be disabled until enhancement`);
    assert.match(pug, /data-auth-form/);
  }
}

function verifyDist() {
  const dist = path.join(root, 'dist');
  assert.ok(fs.existsSync(dist), 'dist/ is required; run the build first');
  const htmlFiles = [];
  const visit = (directory) => {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, item.name);
      if (item.isDirectory()) visit(absolute);
      else if (item.isFile() && item.name.endsWith('.html')) htmlFiles.push(absolute);
    }
  };
  visit(dist);
  assert.ok(htmlFiles.length > 0, 'dist must contain HTML pages');
  const sharedAssetUrls = new Map();
  for (const file of htmlFiles) {
    if (path.relative(dist, file) === '404.html') continue; // system 404 is a standalone Phase 1 document
    const html = fs.readFileSync(file, 'utf8');
    const stylesheetTags = html.match(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi) || [];
    const hrefs = stylesheetTags.map((tag) => tag.match(/\bhref=["']([^"']+)["']/i)?.[1]).filter(Boolean);
    assert.equal(new Set(hrefs).size, hrefs.length, `${path.relative(dist, file)} repeats a stylesheet URL`);
    for (const shared of ['core', 'theme', 'layout']) {
      const matches = hrefs.filter((href) => new RegExp(`/${shared}\\.[a-f0-9]+\\.css(?:$|\\?)`, 'i').test(href));
      assert.equal(matches.length, 1, `${path.relative(dist, file)} must link ${shared} exactly once`);
      if (sharedAssetUrls.has(shared)) assert.equal(matches[0], sharedAssetUrls.get(shared), `${shared} must resolve to the same shared asset on every page`);
      else sharedAssetUrls.set(shared, matches[0]);
    }
    assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/i, `${path.relative(dist, file)} requests an external font`);
  }

  const home = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  assert.match(home, /data-component="site-header"/);
  assert.match(home, /id="primary-navigation"/);
  assert.match(home, /class="nav-toggle"/);
  const inlineInitializer = [...home.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .find(([, attributes, content]) => !/\bsrc\s*=/.test(attributes) && content.trim())?.[2];
  assert.ok(inlineInitializer, 'the generated document must include the first-paint theme initializer');
  const runInitializer = ({ storageDenied = false, saved = {}, osDark = false } = {}) => {
    const htmlRoot = { dataset: { colorSchemePreference: 'system' } };
    const storage = new Map(Object.entries(saved));
    const window = { matchMedia: () => ({ matches: osDark }) };
    Object.defineProperty(window, 'localStorage', {
      get() {
        if (storageDenied) throw new Error('Storage is blocked by browser policy.');
        return {
          getItem(key) { return storage.get(key) ?? null; },
          setItem(key, value) { storage.set(key, String(value)); },
          removeItem(key) { storage.delete(key); },
        };
      },
    });
    vm.runInNewContext(inlineInitializer, { document: { documentElement: htmlRoot }, window });
    return { htmlRoot, storage };
  };
  const deniedStorage = runInitializer({ storageDenied: true, osDark: true });
  assert.equal(deniedStorage.htmlRoot.dataset.colorScheme, 'dark', 'first paint still follows the OS when storage is denied');
  const migratedStorage = runInitializer({ saved: { theme: 'dark' } });
  assert.equal(migratedStorage.htmlRoot.dataset.colorScheme, 'dark', 'legacy preference is applied at first paint');
  assert.equal(migratedStorage.storage.get('interface-kit:color-scheme:v1'), 'dark');
  assert.equal(migratedStorage.storage.has('theme'), false, 'legacy storage is removed after migration');
  const currentPreference = runInitializer({ saved: { 'interface-kit:color-scheme:v1': 'light', theme: 'dark' }, osDark: true });
  assert.equal(currentPreference.htmlRoot.dataset.colorScheme, 'light', 'current preference takes precedence over the legacy key and OS');
  assert.equal(currentPreference.storage.has('theme'), false);
  const docsPath = path.join(dist, 'markdown/index.html');
  if (fs.existsSync(docsPath)) {
    const docs = fs.readFileSync(docsPath, 'utf8');
    assert.match(docs, /data-component="site-header"/);
    assert.match(docs, /class="theme-toggle"/);
  }
}

verifySourceOwnership();
verifyControllerLifecycle();
(async () => {
  await verifySharedUiLifecycles();
  if (!runtimeOnly) verifyDist();
  console.log(`Phase 2 shell ${runtimeOnly ? 'runtime' : 'full'} checks passed: CSS ownership, external font policy, manifest-fed navigation, storage denial, system theme updates, multiple shell instances, Escape/focus, sticky cleanup, tabs/dialog/toast keyboard and lifecycle, auth fallback${runtimeOnly ? '' : ', and dist shell links'}.`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
