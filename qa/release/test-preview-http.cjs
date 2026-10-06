#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { verifyExtractedPreview } = require("./preview-http.cjs");

function write(root, relativePath, value) {
  const filename = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, value);
}

function createFixture(root, basePath) {
  const packageRoot = path.join(root, basePath === "/" ? "root-package" : "subpath-package");
  const prefix = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Preview fixture</title><link rel="stylesheet" href="${prefix}/assets/css/site.css"><link rel="preload" href="${prefix}/assets/fonts/Inter.woff2" as="font" type="font/woff2" crossorigin><script src="${prefix}/assets/js/runtime.js"></script></head><body><main><h1>Preview fixture</h1><picture><source type="image/avif" srcset="${prefix}/assets/images/hero-480.avif 480w, ${prefix}/assets/images/hero-960.avif 960w" sizes="100vw"><source type="image/webp" srcset="${prefix}/assets/images/hero-480.webp 480w, ${prefix}/assets/images/hero-960.webp 960w" sizes="100vw"><img src="${prefix}/assets/images/hero-960.jpg" srcset="${prefix}/assets/images/hero-480.jpg 480w, ${prefix}/assets/images/hero-960.jpg 960w" sizes="100vw" width="960" height="640" alt="Fixture image"></picture><svg aria-hidden="true"><use href="${prefix}/assets/images/ui-icons.a1b2c3d4.svg#icon"></use></svg></main></body></html>`;
  write(packageRoot, "release-manifest.json", JSON.stringify({
    siteUrl: "https://release.example.test",
    basePath,
    html: { root: "html/" },
    pages: [
      { id: "demo.home", route: "/", output: "index.html" },
      { id: "demo.features", route: "/features/", output: "features/index.html" },
    ],
  }));
  write(packageRoot, "html/index.html", html);
  write(packageRoot, "html/features/index.html", "<!doctype html><html lang=\"en\"><head><title>Features fixture</title></head><body><main><h1>Features</h1></main></body></html>");
  write(packageRoot, "html/assets/css/site.css", "body { color: #123456; }\n");
  write(packageRoot, "html/assets/js/runtime.js", "document.documentElement.dataset.previewSmoke = 'ok';\n");
  write(packageRoot, "html/assets/fonts/Inter.woff2", Buffer.from([0, 1, 2, 3]));
  for (const format of ["avif", "webp", "jpg"]) {
    for (const width of [480, 960]) write(packageRoot, `html/assets/images/hero-${width}.${format}`, Buffer.from(`${format}-${width}`));
  }
  write(packageRoot, "html/assets/images/ui-icons.a1b2c3d4.svg", '<svg xmlns="http://www.w3.org/2000/svg"><symbol id="icon" viewBox="0 0 24 24"/></svg>');
  return packageRoot;
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Could not reserve a local preview port.")));
        return;
      }
      const { port } = address;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function verifyCanonicalAboutRedirect(root, basePath) {
  const projectRoot = path.join(root, basePath === "/" ? "preview-root" : "preview-subpath");
  const scriptPath = path.join(projectRoot, "scripts/preview.cjs");
  const helperPath = path.join(projectRoot, "build/helpers/urls.cjs");
  const sourceRoot = path.resolve(__dirname, "../..");
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  fs.mkdirSync(path.dirname(helperPath), { recursive: true });
  fs.copyFileSync(path.join(sourceRoot, "scripts/preview.cjs"), scriptPath);
  fs.copyFileSync(path.join(sourceRoot, "build/helpers/urls.cjs"), helperPath);

  const htmlRoot = path.join(projectRoot, "dist");
  const aboutHtml = "<!doctype html><html lang=\"en\"><head><title>About fixture</title></head><body><main><h1>About fixture</h1></main></body></html>\n";
  write(htmlRoot, "index.html", "<!doctype html><html lang=\"en\"><head><title>Home fixture</title></head><body><main><h1>Home fixture</h1></main></body></html>\n");
  write(htmlRoot, "about/index.html", aboutHtml);
  write(htmlRoot, "features/index.html", "<!doctype html><html lang=\"en\"><head><title>Features fixture</title></head><body><main><h1>Features fixture</h1></main></body></html>\n");
  write(htmlRoot, "404.html", "<!doctype html><html lang=\"en\"><head><title>Not found</title></head><body><h1>Not found</h1></body></html>\n");

  const port = await reservePort();
  const child = spawn(process.execPath, [scriptPath], {
    cwd: projectRoot,
    env: { ...process.env, BASE_PATH: basePath, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${basePath} preview server did not start. stdout=${stdout} stderr=${stderr}`)), 5000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (!stdout.includes("Static preview:")) return;
      clearTimeout(timeout);
      resolve();
    });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      reject(new Error(`${basePath} preview server exited before readiness (${code ?? signal}). stdout=${stdout} stderr=${stderr}`));
    });
  });
  const exited = new Promise((resolve) => child.once("exit", resolve));

  try {
    await ready;
    const origin = `http://127.0.0.1:${port}`;
    const prefix = basePath === "/" ? "" : basePath.replace(/\/$/, "");
    const aboutRequest = `${prefix}/about?source=acceptance`;
    const redirect = await fetch(`${origin}${aboutRequest}`, { redirect: "manual" });
    assert.equal(redirect.status, 308, `${basePath} /about redirects permanently to its canonical slash route`);
    assert.equal(redirect.headers.get("location"), `${prefix}/about/?source=acceptance`, `${basePath} /about preserves its query while adding the canonical slash`);
    await redirect.body?.cancel();

    const about = await fetch(`${origin}${prefix}/about/`, { redirect: "manual" });
    assert.equal(about.status, 200, `${basePath} canonical /about/ route serves successfully`);
    assert.match(about.headers.get("content-type") || "", /^text\/html\b/i, `${basePath} /about/ has an HTML content type`);
    assert.equal(await about.text(), aboutHtml, `${basePath} /about/ serves the directory-index page, not the homepage`);

    const missing = await fetch(`${origin}${prefix}/__preview-about-missing__/`, { redirect: "manual" });
    assert.equal(missing.status, 404, `${basePath} unknown deep route returns HTTP 404`);
    assert.equal(await missing.text(), "<!doctype html><html lang=\"en\"><head><title>Not found</title></head><body><h1>Not found</h1></body></html>\n", `${basePath} unknown deep route serves the 404 document instead of an SPA fallback`);
  } finally {
    child.kill("SIGTERM");
    await Promise.race([
      exited,
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
}

async function main() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "theme-release-http-smoke-"));
  try {
    for (const basePath of ["/", "/preview/theme/"]) {
      const packageRoot = createFixture(fixtureRoot, basePath);
      const result = await verifyExtractedPreview({
        packageRoot,
        label: `HTTP fixture ${basePath}`,
        requireJavaScript: true,
      });
      assert.equal(result.htmlPages, 2);
      assert.equal(result.css, 1);
      assert.equal(result.js, 1);
      assert.equal(result.fonts, 1);
      assert.equal(result.images, 7);
      assert.equal(result.basePath, basePath);
      await verifyCanonicalAboutRedirect(fixtureRoot, basePath);
    }
    process.stdout.write("HTTP preview fixtures passed: extracted root/subpath routes and CSS/JS/font/raster/SVG sprite requests served exact bytes; the actual preview server redirected /about to /about/ and served the resulting page at root and /preview/theme/, with unknown routes returning the 404 document and no SPA fallback.\n");
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`test-preview-http: ${error.stack || error}\n`);
  process.exitCode = 1;
});
