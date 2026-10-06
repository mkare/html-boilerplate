#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const parse5 = require("parse5");

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
  [".xml", "application/xml; charset=utf-8"],
]);

function contentTypeFor(filename) {
  return MIME_TYPES.get(path.extname(filename).toLowerCase()) || "application/octet-stream";
}

function sendNotFound(response) {
  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Not Found\n");
}

function createStaticHandler(htmlRoot, basePath) {
  const root = path.resolve(htmlRoot);

  return (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { allow: "GET, HEAD" });
      response.end();
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    } catch {
      sendNotFound(response);
      return;
    }

    if (basePath !== "/" && !pathname.startsWith(basePath)) {
      sendNotFound(response);
      return;
    }

    const relativePath = basePath === "/" ? pathname.replace(/^\/+/, "") : pathname.slice(basePath.length);
    const segments = relativePath.split("/").filter(Boolean);
    if (segments.some((segment) => segment === "." || segment === ".." || segment.includes("\\"))) {
      sendNotFound(response);
      return;
    }

    const joined = path.resolve(root, ...segments);
    if (joined !== root && !joined.startsWith(`${root}${path.sep}`)) {
      sendNotFound(response);
      return;
    }

    const filename = pathname.endsWith("/") || relativePath === ""
      ? path.join(joined, "index.html")
      : joined;
    if (!filename.startsWith(`${root}${path.sep}`) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
      sendNotFound(response);
      return;
    }

    response.writeHead(200, {
      "content-length": fs.statSync(filename).size,
      "content-type": contentTypeFor(filename),
      "x-content-type-options": "nosniff",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    fs.createReadStream(filename).pipe(response);
  };
}

function collectDocumentAssets(html) {
  const document = parse5.parse(html);
  const assets = { css: new Set(), js: new Set(), fonts: new Set(), images: new Set() };
  const visit = (node) => {
    if (node.tagName === "link") {
      const attributes = Object.fromEntries((node.attrs || []).map(({ name, value }) => [name, value]));
      const rel = (attributes.rel || "").toLowerCase().split(/\s+/);
      if (rel.includes("stylesheet") && attributes.href) assets.css.add(attributes.href);
      if (rel.includes("preload") && attributes.as === "font" && attributes.href) assets.fonts.add(attributes.href);
    }
    if (node.tagName === "script") {
      const src = (node.attrs || []).find((attribute) => attribute.name === "src")?.value;
      if (src) assets.js.add(src);
    }
    const attributes = Object.fromEntries((node.attrs || []).map(({ name, value }) => [name, value]));
    if ((node.tagName === "img" || node.tagName === "source") && attributes.src) assets.images.add(attributes.src);
    if (node.tagName === "use" && attributes.href && !attributes.href.startsWith("#")) assets.images.add(attributes.href);
    if (attributes.srcset && (node.tagName === "img" || node.tagName === "source")) {
      for (const candidate of attributes.srcset.split(",")) {
        const source = candidate.trim().split(/\s+/)[0];
        if (source) assets.images.add(source);
      }
    }
    for (const child of node.childNodes || []) visit(child);
    if (node.content) visit(node.content);
  };
  visit(document);
  return Object.fromEntries(Object.entries(assets).map(([kind, references]) => [kind, [...references]]));
}

function servedPathForRoute(basePath, route) {
  const basePrefix = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  return `${basePrefix}${route === "/" ? "/" : route}`;
}

function localRequestPath(reference, pagePath, siteUrl, serverOrigin) {
  let resolved;
  try {
    resolved = new URL(reference, new URL(pagePath, serverOrigin));
  } catch {
    return null;
  }
  if (resolved.origin !== serverOrigin && resolved.origin !== new URL(siteUrl).origin) return null;
  return `${resolved.pathname}${resolved.search}`;
}

function htmlFilenameForRoute(htmlRoot, pages, route) {
  const page = pages.find((candidate) => candidate.route === route);
  assert.ok(page, `release manifest has no page for route ${route}`);
  const filename = path.resolve(htmlRoot, ...page.output.split("/"));
  assert.ok(filename.startsWith(`${path.resolve(htmlRoot)}${path.sep}`), `unsafe page output ${page.output}`);
  return filename;
}

async function getResponse(url) {
  const response = await fetch(url, { redirect: "manual" });
  return {
    status: response.status,
    contentType: response.headers.get("content-type") || "",
    body: Buffer.from(await response.arrayBuffer()),
  };
}

async function verifyExtractedPreview({ packageRoot, label, requireJavaScript = false }) {
  const release = JSON.parse(fs.readFileSync(path.join(packageRoot, "release-manifest.json"), "utf8"));
  const htmlRoot = path.resolve(packageRoot, release.html?.root || "html");
  const basePath = release.basePath || "/";
  const pages = release.pages || [];
  assert.ok(pages.some((page) => page.route === "/"), `${label} release has a root page`);
  assert.ok(fs.existsSync(path.join(htmlRoot, "index.html")), `${label} release has html/index.html`);

  const server = http.createServer(createStaticHandler(htmlRoot, basePath));
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object", `${label} preview server has a TCP address`);
    const serverOrigin = `http://127.0.0.1:${address.port}`;
    const rootPath = servedPathForRoute(basePath, "/");
    const rootResponse = await getResponse(`${serverOrigin}${rootPath}`);
    assert.equal(rootResponse.status, 200, `${label} root route serves successfully`);
    assert.match(rootResponse.contentType, /^text\/html\b/i, `${label} root route has an HTML content type`);
    assert.deepEqual(rootResponse.body, fs.readFileSync(htmlFilenameForRoute(htmlRoot, pages, "/")), `${label} root route serves the packaged HTML bytes`);

    const nestedPage = pages.find((page) => page.route !== "/" && page.id !== "system.404");
    assert.ok(nestedPage, `${label} release includes a nested route`);
    const nestedPath = servedPathForRoute(basePath, nestedPage.route);
    const nestedResponse = await getResponse(`${serverOrigin}${nestedPath}`);
    assert.equal(nestedResponse.status, 200, `${label} nested route ${nestedPage.route} serves successfully`);
    assert.match(nestedResponse.contentType, /^text\/html\b/i, `${label} nested route has an HTML content type`);
    assert.deepEqual(nestedResponse.body, fs.readFileSync(htmlFilenameForRoute(htmlRoot, pages, nestedPage.route)), `${label} nested route serves the manifest-owned HTML bytes`);

    const assets = collectDocumentAssets(rootResponse.body.toString("utf8"));
    assert.ok(assets.css.length > 0, `${label} root page links a stylesheet`);
    assert.ok(assets.fonts.length > 0, `${label} root page preloads a local font`);
    if (requireJavaScript) assert.ok(assets.js.length > 0, `${label} root page links JavaScript`);

    const requestedCounts = { css: 0, js: 0, fonts: 0, images: 0 };
    const expectedImageTypes = new Map([
      [".avif", /^image\/avif\b/i],
      [".gif", /^image\/gif\b/i],
      [".jpeg", /^image\/jpeg\b/i],
      [".jpg", /^image\/jpeg\b/i],
      [".png", /^image\/png\b/i],
      [".svg", /^image\/svg\+xml\b/i],
      [".webp", /^image\/webp\b/i],
    ]);
    const requests = [
      ...assets.css.map((reference) => ({ kind: "css", reference, expectedType: /^text\/css\b/i })),
      ...assets.js.map((reference) => ({ kind: "js", reference, expectedType: /^(?:text|application)\/javascript\b/i })),
      ...assets.fonts.map((reference) => ({ kind: "fonts", reference, expectedType: /^(?:font\/woff2|application\/font-woff|application\/octet-stream)\b/i })),
      ...assets.images.map((reference) => {
        const pathname = new URL(reference, `http://127.0.0.1${rootPath}`).pathname;
        const extension = path.extname(pathname).toLowerCase();
        return { kind: "images", reference, expectedType: expectedImageTypes.get(extension) };
      }).filter((item) => item.expectedType),
    ];
    for (const item of requests) {
      const requestPath = localRequestPath(item.reference, rootPath, release.siteUrl, serverOrigin);
      if (!requestPath) continue;
      const response = await getResponse(`${serverOrigin}${requestPath}`);
      assert.equal(response.status, 200, `${label} ${item.kind} asset ${item.reference} serves successfully`);
      assert.match(response.contentType, item.expectedType, `${label} ${item.kind} asset has the expected MIME type`);
      assert.ok(response.body.length > 0, `${label} ${item.kind} asset is non-empty`);

      const basePrefix = basePath === "/" ? "" : basePath;
      assert.ok(requestPath.startsWith(basePrefix), `${label} asset stays within basePath ${basePath}`);
      const relative = basePath === "/" ? requestPath.replace(/^\/+/, "") : requestPath.slice(basePath.length);
      const assetFilename = path.resolve(htmlRoot, ...relative.split("/").filter(Boolean));
      assert.ok(assetFilename.startsWith(`${htmlRoot}${path.sep}`), `${label} asset path is contained in html/`);
      assert.deepEqual(response.body, fs.readFileSync(assetFilename), `${label} serves the packaged bytes for ${item.reference}`);
      requestedCounts[item.kind] += 1;
    }
    assert.ok(requestedCounts.css > 0, `${label} preview fetched at least one CSS asset`);
    assert.ok(requestedCounts.fonts > 0, `${label} preview fetched at least one font asset`);
    if (requireJavaScript) assert.ok(requestedCounts.js > 0, `${label} preview fetched at least one JavaScript asset`);
    if (assets.images.length) assert.ok(requestedCounts.images > 0, `${label} preview fetched at least one image or sprite asset`);

    const missingRoute = basePath === "/" ? "/__preview-smoke-missing-route__/" : `${basePath}__preview-smoke-missing-route__/`;
    const missingAsset = basePath === "/" ? "/assets/__preview-smoke-missing__.js" : `${basePath}assets/__preview-smoke-missing__.js`;
    const missingRouteResponse = await getResponse(`${serverOrigin}${missingRoute}`);
    const missingAssetResponse = await getResponse(`${serverOrigin}${missingAsset}`);
    assert.equal(missingRouteResponse.status, 404, `${label} unknown route returns HTTP 404`);
    assert.equal(missingAssetResponse.status, 404, `${label} unknown asset returns HTTP 404`);
    assert.equal(missingRouteResponse.body.toString("utf8"), "Not Found\n", `${label} unknown route is not rewritten to the homepage`);
    assert.equal(missingAssetResponse.body.toString("utf8"), "Not Found\n", `${label} unknown asset is not rewritten to the homepage`);

    return {
      htmlPages: 2,
      ...requestedCounts,
      basePath,
    };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections?.();
    });
  }
}

module.exports = { verifyExtractedPreview };
