#!/usr/bin/env node
/* global document, window */
const fs = require("node:fs");
const path = require("node:path");
const axe = require("axe-core");
const { chromium } = require("playwright");

const projectRoot = path.resolve(__dirname, "../..");
const manifestPath = path.join(projectRoot, ".generated/pages-manifest.json");
const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const maxSnippetLength = 320;

function fail(message) {
  process.stderr.write(`axe QA: ${message}\n`);
  process.exitCode = 1;
}

function readPreview(baseURLArgument) {
  if (!baseURLArgument)
    throw new Error("Pass the catalog-preview base URL, for example http://127.0.0.1:4173/.");
  const baseURL = new URL(baseURLArgument);
  if (
    baseURL.protocol !== "http:" ||
    baseURL.hostname !== "127.0.0.1" ||
    !baseURL.port ||
    baseURL.username ||
    baseURL.password ||
    baseURL.search ||
    baseURL.hash ||
    !baseURL.pathname.endsWith("/")
  ) {
    throw new Error(
      "Use a local HTTP preview URL like http://127.0.0.1:4173/preview/theme/ with no query or fragment.",
    );
  }
  if (!fs.existsSync(manifestPath))
    throw new Error(
      `Missing ${path.relative(projectRoot, manifestPath)}; build the catalog-preview profile first.`,
    );

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.profile !== "catalog-preview") {
    throw new Error(
      `Expected a catalog-preview manifest, found ${JSON.stringify(manifest.profile)}. Build the preview profile first.`,
    );
  }
  if (!manifest.site || !Array.isArray(manifest.pages) || manifest.pages.length === 0) {
    throw new Error(
      "The catalog-preview manifest must contain site metadata and at least one page.",
    );
  }

  const manifestBasePath = manifest.site.basePath;
  if (
    typeof manifestBasePath !== "string" ||
    !manifestBasePath.startsWith("/") ||
    !manifestBasePath.endsWith("/")
  ) {
    throw new Error("Manifest site.basePath must be an absolute path ending in /.");
  }
  if (baseURL.pathname !== manifestBasePath) {
    throw new Error(
      `Preview URL path ${baseURL.pathname} does not match manifest basePath ${manifestBasePath}.`,
    );
  }

  const routes = manifest.pages.map((page) => {
    if (!page || typeof page.route !== "string" || !page.route.startsWith("/")) {
      throw new Error(`Manifest page ${JSON.stringify(page?.id)} has no absolute route.`);
    }
    const routeURL = new URL(page.route.replace(/^\/+/, ""), baseURL);
    if (!routeURL.pathname.startsWith(manifestBasePath)) {
      throw new Error(`Manifest route ${page.route} escapes basePath ${manifestBasePath}.`);
    }
    return {
      id: page.id || page.route,
      route: page.route,
      url: routeURL.href,
      expectsNotFound: page.output === "404.html",
    };
  });
  return { baseURL: baseURL.href, routes };
}

function describeViolation(route, scheme, violation) {
  process.stdout.write(
    `\n[${scheme}] ${route.route} — ${violation.id} (${violation.impact || "impact not rated"})\n`,
  );
  process.stdout.write(`  ${violation.help}\n  ${violation.helpUrl}\n`);
  for (const node of violation.nodes) {
    const target = Array.isArray(node.target) ? node.target.join(", ") : String(node.target);
    process.stdout.write(`  target: ${target || "(no target)"}\n`);
    if (node.failureSummary)
      process.stdout.write(`  reason: ${node.failureSummary.replace(/\s+/g, " ").trim()}\n`);
    if (node.html) {
      const snippet = node.html.replace(/\s+/g, " ").trim();
      process.stdout.write(
        `  html: ${snippet.slice(0, maxSnippetLength)}${snippet.length > maxSnippetLength ? "…" : ""}\n`,
      );
    }
  }
}

async function scan() {
  const { baseURL, routes } = readPreview(process.argv[2]);
  const executablePath = process.env.QA_CHROMIUM_EXECUTABLE_PATH;
  process.stdout.write(
    `Scanning ${routes.length} catalog-preview manifest routes from ${baseURL}\n`,
  );
  process.stdout.write(
    `axe-core ${axe.version}; tags: ${wcagTags.join(", ")}; modes: light, dark\n`,
  );
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: [
      "--disable-background-networking",
      "--disable-sync",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });
  let violationsFound = 0;
  let scanErrors = 0;
  let incompleteChecks = 0;
  try {
    for (const scheme of ["light", "dark"]) {
      const context = await browser.newContext({ colorScheme: scheme, reducedMotion: "reduce" });
      try {
        const page = await context.newPage();
        for (const route of routes) {
          let response;
          try {
            response = await page.goto(route.url, { waitUntil: "networkidle", timeout: 30000 });
          } catch (error) {
            scanErrors += 1;
            process.stderr.write(
              `\n[${scheme}] ${route.route} — navigation failed: ${error.message}\n`,
            );
            continue;
          }
          const status = response?.status() ?? 0;
          if (
            (!route.expectsNotFound && (status < 200 || status >= 300)) ||
            (route.expectsNotFound && status !== 404)
          ) {
            scanErrors += 1;
            process.stderr.write(
              `\n[${scheme}] ${route.route} — unexpected HTTP status ${status || "no response"}\n`,
            );
            continue;
          }
          try {
            await page.addScriptTag({ content: axe.source });
            const results = await page.evaluate(
              (tags) =>
                window.axe.run(document, {
                  runOnly: { type: "tag", values: tags },
                }),
              wcagTags,
            );
            violationsFound += results.violations.length;
            incompleteChecks += results.incomplete.length;
            for (const violation of results.violations) describeViolation(route, scheme, violation);
            for (const check of results.incomplete) {
              process.stdout.write(
                `[${scheme}] ${route.route} — manual review: ${check.id}: ${check.help}\n`,
              );
            }
            process.stdout.write(
              `[${scheme}] ${route.route}: ${results.violations.length} violation(s), ${results.incomplete.length} incomplete/manual review item(s)\n`,
            );
          } catch (error) {
            scanErrors += 1;
            process.stderr.write(
              `\n[${scheme}] ${route.route} — axe scan failed: ${error.message}\n`,
            );
          }
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  process.stdout.write(
    `\nSummary: ${routes.length * 2} route/scheme scans, ${violationsFound} violation(s), ${incompleteChecks} incomplete/manual review item(s), ${scanErrors} navigation/scan error(s).\n`,
  );
  if (violationsFound || scanErrors) process.exitCode = 1;
}

scan().catch((error) => {
  fail(
    `${error.message}${error.message.includes("Executable doesn’t exist") || error.message.includes("browserType.launch") ? "\nInstall the pinned Playwright Chromium with: yarn playwright install chromium" : ""}`,
  );
});
