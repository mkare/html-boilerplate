#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const sass = require("sass");

const repoRoot = path.resolve(__dirname, "../..");
const productionLoader = path.join(repoRoot, "build/overrides/project-overrides.cjs");
const historicalLoaderFixture = path.join(__dirname, "fixtures/upgrade-1.0.0-project-overrides.cjs");

function digest(filename) {
  return crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex");
}

function write(relativeRoot, relativePath, content) {
  const filename = path.join(relativeRoot, relativePath);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, content);
  return filename;
}

function copyTree(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
    else throw new Error(`Unsupported fixture entry: ${from}`);
  }
}

function writeFrameworkRelease(root, version, accent, loaderSourcePath) {
  write(root, "VERSION", `${version}\n`);
  write(root, "defaults/site.json", JSON.stringify({
    brand: { name: `Framework ${version}` },
    tokens: { accent },
    navigation: [{ id: "framework.home", label: "Home" }],
  }, null, 2));
  write(root, "layout.pug", `// framework-owned layout from ${version}\n`);
  const loaderPath = path.join(root, "build/overrides/project-overrides.cjs");
  fs.mkdirSync(path.dirname(loaderPath), { recursive: true });
  fs.copyFileSync(loaderSourcePath, loaderPath);
}

function loadActualOverrides(application, expectedVersion) {
  const loaderPath = path.join(application, "framework/build/overrides/project-overrides.cjs");
  const expectedLoader = expectedVersion === "1.0.0" ? historicalLoaderFixture : productionLoader;
  assert.equal(digest(loaderPath), digest(expectedLoader), "release uses its designated loader implementation");
  delete require.cache[require.resolve(loaderPath)];
  const { loadProjectOverrides } = require(loaderPath);
  const warnings = [];
  const overrides = loadProjectOverrides({
    repoRoot: application,
    demoId: "saas",
    warningSink: (message) => warnings.push(message),
  });

  assert.equal(fs.readFileSync(path.join(application, "framework/VERSION"), "utf8"), `${expectedVersion}\n`);
  assert.equal(overrides.brand.name, "Northstar Studio");
  assert.equal(overrides.brand.logo, "customer/brand.svg");
  assert.ok(fs.existsSync(overrides.brand.logoPath), "customer logo resolves before and after framework replacement");
  assert.deepEqual(overrides.themes, {
    default: {
      light: { "--color-accent": "#b42365" },
      dark: { "--color-accent": "#ef92bd" },
    },
  });
  assert.equal(overrides.themes.default.light["--color-accent"], "#b42365");
  assert.equal(overrides.themes.default.dark["--color-accent"], "#ef92bd");
  assert.deepEqual(overrides.navigation.items[0], {
    pageId: "customer.contact",
    label: "Contact the studio",
    groups: ["main", "footer"],
    order: 10,
  });
  assert.equal(overrides.navigation.items[0].label, "Contact the studio");
  assert.equal(overrides.pageRecords.length, 1);
  assert.equal(overrides.pageRecords[0].id, "customer.contact");
  assert.equal(overrides.pageRecords[0].demoId, "saas");
  assert.equal(overrides.pageRecords[0].route, "/contact/");
  assert.equal(overrides.pageRecords[0].source, "project/overrides/pages/contact/page.pug");
  assert.equal(overrides.pageRecords[0].title, "Contact Northstar Studio");
  assert.ok(overrides.tokensScssPath);
  assert.ok(overrides.customScssPath);
  assert.deepEqual(warnings, [], "valid customer overlay should load without warnings");

  const tokensCss = sass.compile(overrides.tokensScssPath).css;
  const customCss = sass.compile(overrides.customScssPath, { loadPaths: [overrides.overrideRoot] }).css;
  assert.match(tokensCss, /--color-accent:\s*#b42365/);
  assert.match(tokensCss, /--color-accent:\s*#ef92bd/);
  assert.match(customCss, /customer-upgrade-proof/);
  assert.match(customCss, /font-family:\s*"Northstar Inter"/);
  assert.match(customCss, /font-weight:\s*100 900/);
  assert.match(customCss, /font-display:\s*swap/);
  assert.match(customCss, /url\(["']?\.\.\/\.\.\/public\/customer\/fonts\/Inter-Latin\.woff2["']?\)/);
  assert.match(customCss, /--font-family-sans:\s*"Northstar Inter", system-ui, sans-serif/);
  assert.ok(fs.existsSync(path.join(application, "public/customer/fonts/Inter-Latin.woff2")), "customer font source remains available");
  assert.ok(fs.existsSync(path.join(application, "public/customer/fonts/OFL-Inter.txt")), "customer font license remains available");
  return overrides;
}

function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "theme-upgrade-rehearsal-"));
  try {
    const application = path.join(root, "application");
    const framework = path.join(application, "framework");
    const project = path.join(application, "project");
    const currentRelease = path.join(root, "release-1.0.0");
    const nextRelease = path.join(root, "release-1.1.0");
    fs.mkdirSync(application, { recursive: true });
    fs.symlinkSync(path.join(repoRoot, "node_modules"), path.join(application, "node_modules"), "dir");
    assert.notEqual(digest(historicalLoaderFixture), digest(productionLoader), "historical fixture and current production loader must be distinct");

    write(application, "public/customer/brand.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1H0z"/></svg>');
    const customerFontPath = path.join(application, "public/customer/fonts/Inter-Latin.woff2");
    const customerFontLicensePath = path.join(application, "public/customer/fonts/OFL-Inter.txt");
    fs.mkdirSync(path.dirname(customerFontPath), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, "src/assets/fonts/Inter-Latin.woff2"), customerFontPath);
    fs.copyFileSync(path.join(repoRoot, "src/assets/fonts/OFL-Inter.txt"), customerFontLicensePath);
    assert.deepEqual(
      fs.readFileSync(customerFontPath),
      fs.readFileSync(path.join(repoRoot, "src/assets/fonts/Inter-Latin.woff2")),
      "fixture uses the repository's licensed local Inter WOFF2 bytes",
    );
    assert.deepEqual(
      fs.readFileSync(customerFontLicensePath),
      fs.readFileSync(path.join(repoRoot, "src/assets/fonts/OFL-Inter.txt")),
      "fixture keeps the repository's Inter OFL bytes beside the font",
    );
    assert.match(fs.readFileSync(customerFontLicensePath, "utf8"), /SIL OPEN FONT LICENSE Version 1\.1/);
    write(project, "overrides/brand.json", JSON.stringify({ name: "Northstar Studio", logo: "customer/brand.svg" }));
    write(project, "overrides/theme.json", JSON.stringify({
      themes: { default: { light: { "--color-accent": "#b42365" }, dark: { "--color-accent": "#ef92bd" } } },
    }));
    write(project, "overrides/navigation.json", JSON.stringify({
      items: [{ pageId: "customer.contact", label: "Contact the studio", groups: ["main", "footer"], order: 10 }],
      external: [],
    }));
    write(project, "overrides/custom.scss", [
      '@font-face {',
      '  font-family: "Northstar Inter";',
      '  font-style: normal;',
      '  font-weight: 100 900;',
      '  font-display: swap;',
      '  src: url("../../public/customer/fonts/Inter-Latin.woff2") format("woff2");',
      '}',
      '',
      'html[data-theme] {',
      '  --font-family-sans: "Northstar Inter", system-ui, sans-serif;',
      '}',
      '',
      '.customer-upgrade-proof { border-color: #b42365; }',
      '',
    ].join("\n"));
    write(project, "overrides/pages/contact/page.json", JSON.stringify({
      id: "customer.contact",
      demoId: "saas",
      route: "/contact/",
      source: "project/overrides/pages/contact/page.pug",
      title: "Contact Northstar Studio",
      locale: "en",
      layout: "site",
      theme: "default",
      styles: [],
      navigation: { groups: ["main", "footer"], label: "Contact", order: 10 },
    }, null, 2));
    write(project, "overrides/pages/contact/page.pug", "extends @layouts/base.pug\n\nblock content\n  h1 Contact Northstar Studio\n");

    const userFiles = [
      "project/overrides/brand.json",
      "project/overrides/theme.json",
      "project/overrides/navigation.json",
      "project/overrides/custom.scss",
      "project/overrides/pages/contact/page.json",
      "project/overrides/pages/contact/page.pug",
      "public/customer/fonts/Inter-Latin.woff2",
      "public/customer/fonts/OFL-Inter.txt",
    ];
    const userFileHashes = new Map(userFiles.map((relative) => [relative, digest(path.join(application, relative))]));

    writeFrameworkRelease(currentRelease, "1.0.0", "#2563eb", historicalLoaderFixture);
    writeFrameworkRelease(nextRelease, "1.1.0", "#4f46e5", productionLoader);
    copyTree(currentRelease, framework);
    loadActualOverrides(application, "1.0.0");

    fs.rmSync(framework, { recursive: true, force: true });
    copyTree(nextRelease, framework);
    const upgraded = loadActualOverrides(application, "1.1.0");

    for (const relative of userFiles) {
      assert.equal(digest(path.join(application, relative)), userFileHashes.get(relative), `${relative} survives framework replacement byte-for-byte`);
    }
    assert.ok(fs.existsSync(upgraded.brand.logoPath), "customer logo remains available after upgrade");
    process.stdout.write("Upgrade rehearsal passed in a temporary application: the standalone historical 1.0.0 loader fixture and current production 1.1.0 loader both read the brand, logo, semantic theme, navigation, custom page, and custom font Sass; customer-owned files and font/license remained byte-identical across the synthetic framework replacement. This rehearsal uses synthetic fixtures, not published release archives.\n");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try { main(); }
  catch (error) { process.stderr.write(`rehearse-upgrade: ${error.message}\n`); process.exitCode = 1; }
}
