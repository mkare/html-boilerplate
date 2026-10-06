#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const parse5 = require("parse5");
const pug = require("pug");
const { assertProps } = require("../../build/helpers/assert-props.cjs");

const repoRoot = path.resolve(__dirname, "../..");
const buttonTemplate = fs.readFileSync(path.join(repoRoot, "src/ui/atoms/button/button.pug"), "utf8");
const fixturePath = path.join(repoRoot, "qa/fixtures/button-attributes.pug");

function render(template) {
  return pug.render(`${buttonTemplate}\n${template}`, {
    assertProps: (componentName, props, schema) => assertProps(componentName, props, schema, {
      pageId: "qa.button-attributes",
      source: "qa/fixtures/button-attributes.pug",
    }),
  }, { filename: fixturePath, basedir: repoRoot });
}

function readButton(markup) {
  const fragment = parse5.parseFragment(markup);
  const buttons = fragment.childNodes.filter((node) => node.tagName === "button");
  assert.equal(buttons.length, 1, "the fixture must render one button");
  return {
    attributes: new Map(buttons[0].attrs.map(({ name, value }) => [name, value])),
    text: buttons[0].childNodes.map((node) => node.value || "").join(""),
  };
}

const defaultsAndForwardedValues = render(fs.readFileSync(fixturePath, "utf8"));
const overridden = readButton(defaultsAndForwardedValues);
assert.equal(overridden.attributes.get("class"), "ui-button ui-button--secondary ui-button--lg caller-class", "forwarded classes merge with component classes");
assert.equal(overridden.attributes.get("type"), "reset", "forwarded type wins over the type option");
assert.equal(overridden.attributes.has("disabled"), false, "forwarded disabled=false wins over disabled=true in options");
assert.equal(overridden.attributes.get("aria-label"), "Forwarded label", "the forwarded aria-label wins over ariaLabel");
assert.equal(overridden.attributes.get("data-test"), "forwarded", "unrelated native attributes are forwarded");
assert.equal(overridden.text, "Save");

const optionValues = readButton(render('+uiButton({ label: "Delete", variant: "danger", type: "submit", disabled: true })'));
assert.equal(optionValues.attributes.get("class"), "ui-button ui-button--danger ui-button--md");
assert.equal(optionValues.attributes.get("type"), "submit");
assert.equal(optionValues.attributes.has("disabled"), true, "the disabled option is used when no call attribute overrides it");

process.stdout.write("Button attribute precedence passed: class merge, forwarded type/disabled/aria-label precedence, and option defaults.\n");
