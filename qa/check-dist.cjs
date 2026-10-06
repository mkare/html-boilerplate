const fs = require("node:fs");
const path = require("node:path");
const { normalizeBasePath } = require("../build/helpers/urls.cjs");

const root = path.resolve(__dirname, "../dist");
const manifestPath = path.resolve(__dirname, "../.generated/pages-manifest.json");
const errors = [];

function fail(file, message) {
  errors.push(`${file}: ${message}`);
}

function listFiles(directory, found = []) {
  if (!fs.existsSync(directory)) return found;
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, item.name);
    if (item.isDirectory()) listFiles(absolute, found);
    else if (item.isFile()) found.push(absolute);
  }
  return found;
}

function decodeEntities(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, (entity) => {
    const lower = entity.toLowerCase();
    if (lower === "&amp;") return "&";
    if (lower === "&quot;") return '"';
    if (lower === "&apos;") return "'";
    if (lower === "&lt;") return "<";
    if (lower === "&gt;") return ">";
    const hex = lower.startsWith("&#x");
    const numeric = Number.parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
    return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : entity;
  });
}

function decodeXml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function parseAttributes(tag) {
  const attributes = {};
  const opening = tag.match(/^<\s*[A-Za-z][\w:-]*/)?.[0] || "";
  const body = tag.slice(opening.length, -1);
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = pattern.exec(body)))
    attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
  return attributes;
}

function openTagAttributes(content, tagName) {
  const pattern = new RegExp(`<(?:(?:${tagName}))\\b[^>]*>`, "gi");
  return [...content.matchAll(pattern)].map((match) => parseAttributes(match[0]));
}

function archivePageNumber(page) {
  return Number(page.route.match(/\/page\/(\d+)\/$/)?.[1] || 1);
}

function checkBlogPagination(manifest, report = fail) {
  const archives = (manifest.pages || [])
    .filter((page) => page.blueprintId === "blog.archive")
    .sort((left, right) => archivePageNumber(left) - archivePageNumber(right));
  if (archives.length < 2) return;

  const inspect = (page) => {
    const htmlPath = path.join(root, ...page.output.split("/"));
    const html = fs.readFileSync(htmlPath, "utf8");
    const relations = openTagAttributes(html, "link").filter((attributes) =>
      ["prev", "next"].includes(attributes.rel),
    );
    const controls = openTagAttributes(html, "a|span").filter((attributes) =>
      (attributes.class || "").split(/\s+/).includes("blog-pagination__control"),
    );
    return { html, relations, controls };
  };
  const first = archives[0];
  const second = archives[1];
  const last = archives.at(-1);
  const previousToLast = archives.at(-2);
  const expectedHrefSuffix = (route) => route;
  const firstDocument = inspect(first);
  const lastDocument = inspect(last);

  if (
    !firstDocument.relations.some(
      (link) => link.rel === "next" && link.href?.endsWith(expectedHrefSuffix(second.route)),
    )
  ) {
    report(
      first.output,
      `first blog archive must advertise the emitted next route ${second.route} in its head.`,
    );
  }
  if (firstDocument.relations.some((link) => link.rel === "prev")) {
    report(first.output, "first blog archive must not advertise a previous page.");
  }
  if (
    !lastDocument.relations.some(
      (link) =>
        link.rel === "prev" && link.href?.endsWith(expectedHrefSuffix(previousToLast.route)),
    )
  ) {
    report(
      last.output,
      `last blog archive must advertise the emitted previous route ${previousToLast.route} in its head.`,
    );
  }
  if (lastDocument.relations.some((link) => link.rel === "next")) {
    report(last.output, "last blog archive must not advertise a next page.");
  }

  const firstControls = firstDocument.controls;
  if (
    firstControls.length !== 2 ||
    firstControls[0].href ||
    firstControls[0]["aria-disabled"] !== "true" ||
    !firstControls[1].href?.endsWith(expectedHrefSuffix(second.route))
  ) {
    report(
      first.output,
      "first blog archive must show a disabled previous control and a real next-page link.",
    );
  }
  const lastControls = lastDocument.controls;
  if (
    lastControls.length !== 2 ||
    !lastControls[0].href?.endsWith(expectedHrefSuffix(previousToLast.route)) ||
    lastControls[1].href ||
    lastControls[1]["aria-disabled"] !== "true"
  ) {
    report(
      last.output,
      "last blog archive must show a real previous-page link and a disabled next control.",
    );
  }
}

function parseHtml(content) {
  const ids = new Set();
  const references = [];
  const tags = content.match(/<\s*[A-Za-z][^>]*>/g) || [];
  for (const tag of tags) {
    const name = tag.match(/^<\s*([A-Za-z][\w:-]*)/)?.[1]?.toLowerCase();
    if (!name) continue;
    const attributes = parseAttributes(tag);
    if (attributes.id !== undefined) {
      if (ids.has(attributes.id)) references.push({ kind: "duplicate-id", value: attributes.id });
      ids.add(attributes.id);
    }
    if (attributes.href !== undefined)
      references.push({
        kind: name === "a" || name === "area" ? "route" : "asset",
        value: attributes.href,
      });
    if (attributes.action !== undefined && name === "form")
      references.push({ kind: "route", value: attributes.action });
    for (const attribute of ["src", "poster"]) {
      if (attributes[attribute] !== undefined)
        references.push({ kind: "asset", value: attributes[attribute] });
    }
    if (attributes.srcset) {
      for (const candidate of attributes.srcset.split(",")) {
        const source = candidate.trim().split(/\s+/)[0];
        if (source) references.push({ kind: "asset", value: source });
      }
    }
  }
  return { ids, references };
}

function decodePathname(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function outputForUrl(urlPath, sourceOutput, basePath) {
  let localPath = urlPath;
  if (localPath.startsWith("/")) {
    if (basePath !== "/") {
      if (!localPath.startsWith(basePath)) return { outsideBase: true };
      localPath = `/${localPath.slice(basePath.length)}`;
    }
  } else {
    localPath = path.posix.join(path.posix.dirname(sourceOutput), localPath);
  }
  const decoded = decodePathname(localPath);
  if (decoded === null || decoded.includes("\\")) return { unsafe: true };
  let output = decoded.replace(/^\/+/, "");
  if (!output) output = "index.html";
  if (output.endsWith("/")) output += "index.html";
  else if (!path.posix.extname(output)) output += "/index.html";
  if (output.split("/").some((part) => part === "." || part === "..")) return { unsafe: true };
  return { output };
}

function isExternal(value) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value) && !value.startsWith("#");
}

function checkReference(reference, { sourceOutput, ids, idsByFile, basePath, siteUrl }) {
  const issues = [];
  const report = (message) => issues.push(message);
  const value = reference.value.trim();
  if (!value || /^(?:data:|javascript:|mailto:|tel:|blob:)/i.test(value)) return issues;
  let url;
  try {
    if (/^https?:\/\//i.test(value) && siteUrl) {
      const parsed = new URL(value);
      const configured = new URL(siteUrl);
      if (parsed.origin !== configured.origin) return issues;
      url = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } else if (isExternal(value)) return issues;
    else url = value;
  } catch {
    report(`invalid URL "${value}".`);
    return issues;
  }

  const fragmentIndex = url.indexOf("#");
  const fragment = fragmentIndex >= 0 ? decodePathname(url.slice(fragmentIndex + 1)) : null;
  const beforeFragment = fragmentIndex >= 0 ? url.slice(0, fragmentIndex) : url;
  const queryIndex = beforeFragment.indexOf("?");
  const pathname = queryIndex >= 0 ? beforeFragment.slice(0, queryIndex) : beforeFragment;

  if (
    reference.kind === "route" &&
    pathname &&
    !path.posix.extname(pathname) &&
    !pathname.endsWith("/")
  ) {
    report(`internal route must end with a slash: "${value}".`);
  }

  let target = null;
  if (pathname) {
    target = outputForUrl(pathname, sourceOutput, basePath);
    if (target.outsideBase) {
      report(`internal path "${pathname}" is outside configured basePath "${basePath}".`);
      return issues;
    }
    if (target.unsafe) {
      report(`unsafe local path "${pathname}".`);
      return issues;
    }
  }

  if (fragmentIndex >= 0) {
    if (fragment === null) report(`invalid encoded fragment in "${value}".`);
    else if (!fragment && reference.kind === "route")
      report('empty fragment link "#" has no target.');
    else if (fragment && reference.kind === "route") {
      const targetIds = pathname ? idsByFile?.get(target.output) : ids;
      if (targetIds && !targetIds.has(fragment))
        report(
          `fragment "#${fragment}" has no matching id in ${pathname ? `dist/${target.output}` : "this page"}.`,
        );
    }
  }

  if (pathname && !fs.existsSync(path.join(root, target.output)))
    report(`local ${reference.kind} target "${value}" resolves to missing dist/${target.output}.`);
  return issues;
}

function main() {
  if (!fs.existsSync(root)) {
    process.stderr.write("dist/ does not exist. Run the production build first.\n");
    process.exitCode = 1;
    return;
  }
  if (!fs.existsSync(manifestPath)) {
    process.stderr.write(
      ".generated/pages-manifest.json is missing. Run the Webpack build first.\n",
    );
    process.exitCode = 1;
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const basePath = normalizeBasePath(manifest.site?.basePath || "/");
  const siteUrl = manifest.site?.siteUrl || null;
  const distFiles = listFiles(root);
  const htmlFiles = distFiles.filter((file) => file.endsWith(".html"));
  const idsByFile = new Map();
  const outputKeys = new Map();

  for (const file of distFiles) {
    const relative = path.relative(root, file).split(path.sep).join("/");
    const key = relative.normalize("NFC").toLocaleLowerCase("en-US");
    const prior = outputKeys.get(key);
    if (prior && prior !== relative)
      fail(relative, `output path collides by case/Unicode normalization with dist/${prior}.`);
    else outputKeys.set(key, relative);
  }

  for (const file of htmlFiles) {
    const relative = path.relative(root, file).split(path.sep).join("/");
    const parsed = parseHtml(fs.readFileSync(file, "utf8"));
    idsByFile.set(relative, parsed.ids);
    for (const reference of parsed.references) {
      if (reference.kind === "duplicate-id") fail(relative, `duplicate id="${reference.value}".`);
    }
  }

  const outputByRoute = new Map();
  for (const page of manifest.pages || []) outputByRoute.set(page.route, page.output);
  checkBlogPagination(manifest, fail);
  for (const file of htmlFiles) {
    const relative = path.relative(root, file).split(path.sep).join("/");
    const parsed = parseHtml(fs.readFileSync(file, "utf8"));
    for (const reference of parsed.references) {
      for (const issue of checkReference(reference, {
        sourceOutput: relative,
        ids: idsByFile.get(relative),
        idsByFile,
        basePath,
        siteUrl,
      }))
        fail(relative, issue);
    }
  }

  for (const file of distFiles.filter((item) => item.endsWith(".css"))) {
    const relative = path.relative(root, file).split(path.sep).join("/");
    const css = fs.readFileSync(file, "utf8");
    const pattern = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
    let match;
    while ((match = pattern.exec(css))) {
      const value = match[2].trim();
      if (value && !/^#|^(?:data:|https?:|\/\/)/i.test(value)) {
        for (const issue of checkReference(
          { kind: "asset", value },
          { sourceOutput: relative, ids: new Set(), basePath, siteUrl },
        ))
          fail(relative, issue);
      }
    }
  }

  const minifiedProfiles = new Set([
    "catalog-preview",
    "customer-production",
    "starter",
    "release-html",
  ]);
  if (minifiedProfiles.has(manifest.profile)) {
    const isGeneratedAsset = (item, directory, extension) =>
      path.relative(root, item).split(path.sep).join("/").startsWith(`${directory}/`) &&
      item.endsWith(extension);
    const cssFiles = distFiles.filter((item) => isGeneratedAsset(item, "assets/css", ".css"));
    const jsFiles = distFiles.filter((item) => isGeneratedAsset(item, "assets/js", ".js"));
    if (!cssFiles.length)
      fail("dist", "production profile must emit CSS assets to verify compressed Sass output.");
    if (!jsFiles.length)
      fail("dist", "production profile must emit JavaScript assets to verify minimization.");
    for (const file of [...cssFiles, ...jsFiles]) {
      const relative = path.relative(root, file).split(path.sep).join("/");
      const source = fs.readFileSync(file, "utf8");
      if (/[\r\n]/.test(source))
        fail(relative, "production CSS/JS asset must be a single minified line.");
    }
  }

  const expectedPages = (manifest.pages || []).length;
  if (htmlFiles.length !== expectedPages)
    fail(
      "dist",
      `expected ${expectedPages} HTML outputs from the manifest, found ${htmlFiles.length}.`,
    );
  if (
    !(manifest.pages || []).some((page) => page.output === "404.html") ||
    !fs.existsSync(path.join(root, "404.html"))
  ) {
    fail("dist", "404.html is required by the manifest but was not emitted.");
  }
  if (manifest.profile === "catalog-preview") {
    for (const file of htmlFiles) {
      const html = fs.readFileSync(file, "utf8");
      if (!/<meta\s+name=["']robots["']\s+content=["']noindex,follow["']/i.test(html)) {
        fail(
          path.relative(root, file).split(path.sep).join("/"),
          "catalog-preview output is missing robots noindex metadata.",
        );
      }
    }
  }

  const robotsFile = path.join(root, "robots.txt");
  if (!fs.existsSync(robotsFile)) fail("dist/robots.txt", "robots.txt is required.");
  else if (manifest.profile === "catalog-preview") {
    const robots = fs.readFileSync(robotsFile, "utf8");
    if (!/^User-agent: \*/m.test(robots) || !/^Allow: \/$/m.test(robots))
      fail(
        "dist/robots.txt",
        "preview robots.txt must remain readable so crawlers can see noindex metadata.",
      );
    if (fs.existsSync(path.join(root, "sitemap.xml")))
      fail("dist/sitemap.xml", "catalog-preview must not publish an indexable sitemap.");
  } else if (siteUrl) {
    const sitemapFile = path.join(root, "sitemap.xml");
    if (!fs.existsSync(sitemapFile))
      fail("dist/sitemap.xml", "a configured production SITE_URL requires sitemap.xml.");
    else {
      const sitemap = fs.readFileSync(sitemapFile, "utf8");
      const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) =>
        decodeXml(match[1]),
      );
      const basePrefix = basePath === "/" ? "" : basePath.replace(/\/$/, "");
      const expected = (manifest.pages || [])
        .filter(
          (page) =>
            page.id !== "system.404" &&
            !(page.robots || "")
              .split(",")
              .some((directive) => directive.trim().toLowerCase() === "noindex"),
        )
        .map((page) => `${siteUrl}${basePrefix}${page.route === "/" ? "/" : page.route}`);
      if (locations.length !== expected.length)
        fail(
          "dist/sitemap.xml",
          `expected ${expected.length} indexable page URLs, found ${locations.length}.`,
        );
      const locationSet = new Set(locations);
      for (const url of expected)
        if (!locationSet.has(url)) fail("dist/sitemap.xml", `missing page URL ${url}.`);
      const robots = fs.existsSync(robotsFile) ? fs.readFileSync(robotsFile, "utf8") : "";
      if (!robots.includes(`Sitemap: ${siteUrl}${basePath}sitemap.xml`))
        fail("dist/robots.txt", "robots.txt must point crawlers to the configured sitemap.");
    }
  }

  if (errors.length) {
    process.stderr.write(
      `check:dist found ${errors.length} issue(s) across ${htmlFiles.length} HTML file(s):\n`,
    );
    for (const error of errors) process.stderr.write(`- ${error}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `check:dist passed: ${htmlFiles.length} HTML files, ${distFiles.length} output files, basePath ${basePath}.\n`,
    );
  }
}

if (require.main === module) main();

module.exports = { parseHtml, outputForUrl, checkReference, checkBlogPagination };
