#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const parse5 = require("parse5");

function walk(node, callback) {
  callback(node);
  for (const child of node.childNodes || []) walk(child, callback);
  if (node.content) walk(node.content, callback);
}

function attrs(node) {
  return Object.fromEntries((node.attrs || []).map((attribute) => [attribute.name, attribute.value]));
}

function inlineText(node) {
  return node.childNodes?.map((child) => child.value || "").join("") || "";
}

function contentHash(value) {
  return `'sha256-${crypto.createHash("sha256").update(value).digest("base64")}'`;
}

function verifyCsp(packageRoot) {
  const manifestPath = path.join(packageRoot, "release-manifest.json");
  const policyPath = path.join(packageRoot, "CSP-HEADER.txt");
  if (!fs.existsSync(manifestPath) || !fs.existsSync(policyPath)) throw new Error("release-manifest.json or CSP-HEADER.txt is missing.");
  const release = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const policy = fs.readFileSync(policyPath, "utf8");
  if (/unsafe-inline|unsafe-eval/i.test(policy)) throw new Error("CSP must not allow unsafe-inline or unsafe-eval.");
  if (!policy.includes("default-src 'self'") || !policy.includes("object-src 'none'") || !policy.includes("base-uri 'self'")) throw new Error("CSP is missing a required restrictive directive.");
  if (!release.csp?.disallowsUnsafeInline) throw new Error("Release manifest does not declare the strict CSP contract.");

  const scriptHashes = new Set();
  const styleHashes = new Set();
  const styleAttrHashes = new Set();
  let pagesChecked = 0;
  const htmlRoot = path.join(packageRoot, release.html?.root || "html");
  for (const page of release.pages || []) {
    const filename = path.join(htmlRoot, ...page.output.split("/"));
    if (!fs.existsSync(filename)) throw new Error(`Missing page for CSP check: ${page.output}`);
    const document = parse5.parse(fs.readFileSync(filename, "utf8"));
    const nodes = [];
    walk(document, (node) => { if (node.tagName) nodes.push(node); });
    const themeScript = nodes.find((node) => {
      if (node.tagName !== "script" || attrs(node).src) return false;
      const content = inlineText(node);
      return content.includes("colorSchemePreference") && content.includes("matchMedia");
    });
    const minimal404 = page.id === "system.404";
    if (!themeScript && !minimal404) throw new Error(`${page.id} has no recognizable first-paint color-scheme script.`);
    const head = nodes.find((node) => node.tagName === "head");
    const headChildren = head?.childNodes || [];
    const themeIndex = headChildren.indexOf(themeScript);
    const firstStylesheetIndex = headChildren.findIndex((node) => node.tagName === "link" && (attrs(node).rel || "").toLowerCase().split(/\s+/).includes("stylesheet"));
    if (!minimal404 && (themeIndex < 0 || firstStylesheetIndex < 0 || themeIndex > firstStylesheetIndex)) {
      throw new Error(`${page.id} theme setup does not precede the first stylesheet request.`);
    }

    for (const node of nodes) {
      const attributes = attrs(node);
      if (node.tagName === "script" && !attributes.src) scriptHashes.add(contentHash(inlineText(node)));
      if (node.tagName === "style") styleHashes.add(contentHash(inlineText(node)));
      if (attributes.style !== undefined) styleAttrHashes.add(contentHash(attributes.style));
    }
    pagesChecked += 1;
  }
  const missingScript = [...scriptHashes].filter((hash) => !policy.includes(hash));
  const missingStyle = [...styleHashes].filter((hash) => !policy.includes(hash));
  const missingStyleAttr = [...styleAttrHashes].filter((hash) => !policy.includes(hash));
  if (missingScript.length || missingStyle.length || missingStyleAttr.length) throw new Error("CSP is missing one or more hashes required by the emitted HTML.");
  if (!Array.isArray(release.csp.inlineScriptHashes) || scriptHashes.size !== release.csp.inlineScriptHashes.length || [...scriptHashes].some((hash) => !release.csp.inlineScriptHashes.includes(hash))) {
    throw new Error("Release manifest CSP script hashes do not match the emitted HTML.");
  }
  return { pagesChecked, inlineScriptHashes: scriptHashes.size, inlineStyleHashes: styleHashes.size, inlineStyleAttributeHashes: styleAttrHashes.size };
}

function main() {
  const rootArg = process.argv[2];
  if (!rootArg || rootArg === "--help" || rootArg === "-h") {
    process.stdout.write("Usage: node qa/release/check-csp.cjs <extracted-release-root>\n");
    if (!rootArg) process.exitCode = 1;
    return;
  }
  const result = verifyCsp(path.resolve(rootArg));
  process.stdout.write(`CSP first-paint check passed: ${result.pagesChecked} pages; ${result.inlineScriptHashes} inline script hashes; unsafe-inline/eval disallowed.\n`);
}

if (require.main === module) {
  try { main(); }
  catch (error) { process.stderr.write(`check-csp: ${error.message}\n`); process.exitCode = 1; }
}

module.exports = { verifyCsp };
