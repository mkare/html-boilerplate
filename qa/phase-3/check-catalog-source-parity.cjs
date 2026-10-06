#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const pugLexer = require("pug-lexer");
const pugParser = require("pug-parser");
const pug = require("pug");
const parse5 = require("parse5");
const { assertProps } = require("../../build/helpers/assert-props.cjs");

const repoRoot = path.resolve(__dirname, "../..");
const pugPath = path.join(repoRoot, "src/views/components/components.pug");
const jsPath = path.join(repoRoot, "src/views/components/components.js");
const browserPath = path.join(
  repoRoot,
  "qa/visual/acceptance.mjs",
);
const pugSource = fs.readFileSync(pugPath, "utf8");
const jsSource = fs.readFileSync(jsPath, "utf8");
const browserSource = fs.readFileSync(browserPath, "utf8");

const examples = [
  { name: "quick-start", codeId: "quick-start-code", selector: ".anatomy-stage > button" },
  { name: "layout", codeId: "layout-code", selector: ".layout-demo" },
  { name: "buttons", codeId: "button-code", selector: "#button-variant-preview button" },
  { name: "tabs", codeId: "tabs-code", selector: ".tabs-example-source" },
  { name: "forms", codeId: "form-code", selector: "#demo-form" },
  { name: "content", codeId: "content-code", selector: "#content-example-source" },
];

pugParser(pugLexer(pugSource, { filename: pugPath }), { filename: pugPath });

for (const { name, codeId, selector } of examples) {
  assert.ok(
    pugSource.includes(`code#${codeId}`),
    `${name} needs a source code target in the Pug template.`,
  );
  assert.ok(
    jsSource.includes(`{ codeId: "${codeId}", selector: "${selector}" }`),
    `${name} must be paired with its live DOM selector in the catalog controller.`,
  );
  assert.ok(
    browserSource.includes(`{ name: '${name}', codeId: '${codeId}', selectors: ['${selector}'] }`),
    `${name} must have an exact browser parity assertion.`,
  );
}

assert.match(
  jsSource,
  /code\.textContent = examples\.map\(\(example\) => example\.outerHTML\)\.join\("\\n"\);/,
);
assert.doesNotMatch(jsSource, /code\.innerHTML\s*=/, "rendered examples must be inserted as text");
assert.ok(
  pugSource.includes("code#foundation-token-code"),
  "the non-HTML CSS example remains in the catalog",
);
assert.ok(
  !examples.some(({ codeId }) => codeId === "foundation-token-code"),
  "the CSS example must stay outside HTML source parity mapping",
);

const authPages = [
  {
    file: "sign-in/page.pug",
    formId: "orbit-sign-in",
    noteId: "orbit-sign-in-note",
    fields: [
      { id: "orbit-sign-in-email", name: "email", label: "Work email address", type: "email", autocomplete: "email", placeholder: "you@company.com" },
      { id: "orbit-sign-in-password", name: "password", label: "Password", type: "password", autocomplete: "current-password", placeholder: "Enter your password" },
    ],
    button: "Sign in",
    links: [
      { href: "/reset-password/", label: "Forgot password?" },
      { href: "/create-account/", label: "Create an account" },
    ],
  },
  {
    file: "create-account/page.pug",
    formId: "orbit-create-account",
    noteId: "orbit-create-note",
    fields: [
      { id: "orbit-create-name", name: "name", label: "Your name", type: "text", autocomplete: "name", placeholder: "Alex Morgan" },
      { id: "orbit-create-email", name: "email", label: "Work email address", type: "email", autocomplete: "email", placeholder: "you@company.com" },
      { id: "orbit-create-password", name: "password", label: "Create a password", type: "password", autocomplete: "new-password", placeholder: "At least 8 characters" },
    ],
    button: "Create workspace",
    links: [{ href: "/sign-in/", label: "Sign in" }],
  },
  {
    file: "reset-password/page.pug",
    formId: "orbit-password-reset",
    noteId: "orbit-reset-note",
    fields: [
      { id: "orbit-reset-email", name: "email", label: "Work email address", type: "email", autocomplete: "email", placeholder: "you@company.com" },
    ],
    button: "Continue",
    links: [{ href: "/sign-in/", label: "Return to sign in" }],
  },
];

const authRoutes = {
  "saas.home": "/",
  "saas.auth.sign-in": "/sign-in/",
  "saas.auth.create-account": "/create-account/",
  "saas.auth.reset-password": "/reset-password/",
};

function visit(node, callback) {
  callback(node);
  for (const child of node.childNodes || []) visit(child, callback);
  if (node.content) visit(node.content, callback);
}

function findElements(document, predicate) {
  const found = [];
  visit(document, (node) => {
    if (node.tagName && predicate(node)) found.push(node);
  });
  return found;
}

function attributes(element) {
  return Object.fromEntries((element.attrs || []).map(({ name, value }) => [name, value]));
}

function visibleText(node) {
  if (node.nodeName === "#text") return node.value;
  if (attributes(node)["aria-hidden"] === "true") return "";
  return (node.childNodes || []).map(visibleText).join("");
}

function isDescendant(root, target) {
  if (root === target) return true;
  return (root.childNodes || []).some((child) => isDescendant(child, target));
}

for (const page of authPages) {
  const filename = path.join(repoRoot, "src/pages/saas/auth", page.file);
  const original = fs.readFileSync(filename, "utf8");
  pugParser(pugLexer(original, { filename }), { filename });
  let includes = 0;
  const source = original.replace(/^include @ui\/(.+)\.pug\s*$/gm, (_include, relative) => {
    includes += 1;
    return fs.readFileSync(path.join(repoRoot, "src/ui", `${relative}.pug`), "utf8");
  });
  assert.equal(includes, 3, `${page.file} must include button, link, and field UI components`);
  const html = pug.render(source, {
    filename,
    assertProps,
    route: (id) => authRoutes[id],
    saas: { auth: { signInTitle: "Sign in", createTitle: "Create a workspace", resetTitle: "Reset your password" } },
  });
  const document = parse5.parse(html);
  const allIds = findElements(document, (element) => attributes(element).id).map((element) => attributes(element).id);
  assert.equal(new Set(allIds).size, allIds.length, `${page.file} must preserve unique IDs`);

  const form = findElements(document, (element) => element.tagName === "form" && attributes(element).id === page.formId)[0];
  assert.ok(form, `${page.file} must retain form #${page.formId}`);
  assert.equal(attributes(form)["aria-describedby"], page.noteId, `${page.file} must preserve the form's note relationship`);
  assert.equal(attributes(form).action, undefined, `${page.file} must remain a local demo form without a new action`);
  assert.equal(attributes(form).method, undefined, `${page.file} must preserve the existing default form method`);

  const fieldsets = findElements(form, (element) => element.tagName === "fieldset");
  assert.equal(fieldsets.length, 1, `${page.file} must retain one fieldset boundary`);
  assert.ok("disabled" in attributes(fieldsets[0]), `${page.file} credential fields must remain disabled before enhancement`);
  const inputs = findElements(form, (element) => element.tagName === "input");
  assert.deepEqual(inputs.map((element) => {
    const attrs = attributes(element);
    return {
      id: attrs.id,
      name: attrs.name,
      type: attrs.type,
      autocomplete: attrs.autocomplete,
      placeholder: attrs.placeholder,
    };
  }), page.fields.map(({ id, name, type, autocomplete, placeholder }) => ({ id, name, type, autocomplete, placeholder })), `${page.file} must preserve native field attributes`);
  const labels = findElements(form, (element) => element.tagName === "label").map((element) => ({
    for: attributes(element).for,
    label: visibleText(element).trim(),
  }));
  assert.deepEqual(labels, page.fields.map(({ id, label }) => ({ for: id, label })), `${page.file} labels must remain connected to their unique fields`);

  const buttons = findElements(form, (element) => element.tagName === "button");
  assert.equal(buttons.length, 1, `${page.file} must retain one submit action`);
  assert.equal(attributes(buttons[0]).type, "submit", `${page.file} submit action must remain a native submit button`);
  assert.ok(attributes(buttons[0]).class.split(/\s+/).includes("ui-button"), `${page.file} submit action must use uiButton`);
  assert.ok(attributes(buttons[0]).class.split(/\s+/).includes("auth-submit"), `${page.file} must preserve its page-owned submit styling hook`);
  assert.equal(visibleText(buttons[0]).trim(), page.button, `${page.file} submit text must remain unchanged`);
  assert.ok(isDescendant(fieldsets[0], buttons[0]), `${page.file} submit action must remain inside the disabled fieldset`);

  const links = findElements(document, (element) => element.tagName === "a" && attributes(element).class.split(/\s+/).includes("ui-link"));
  assert.deepEqual(links.map((element) => ({ href: attributes(element).href, label: visibleText(element).trim() })), page.links, `${page.file} must preserve inline link destinations and labels through uiLink`);
}

const authStyles = fs.readFileSync(path.join(repoRoot, "src/pages/saas/auth/auth.scss"), "utf8");
for (const modulePath of ["@ui/atoms/button/button", "@ui/atoms/link/link", "@ui/molecules/field/field"]) {
  assert.ok(authStyles.includes(`@use "${modulePath}";`), `auth.scss must bundle ${modulePath} styles`);
}
assert.ok(authStyles.indexOf("@use \"@ui/molecules/field/field\";") < authStyles.indexOf("@use \"../../../views/auth/auth-shared\";"), "page-owned auth styles must follow the shared primitive styles");
assert.match(authStyles, /\.auth-page \.auth-inline-link \.ui-link__arrow\s*\{\s*display:\s*none;/, "auth links keep their existing text-only appearance while using uiLink semantics");

process.stdout.write(
  "Catalog source parity contract passed for quick-start, layout, buttons, tabs, forms, and content; SaaS auth fields/actions/links also consume the documented shared UI APIs without changing form semantics.\n",
);
