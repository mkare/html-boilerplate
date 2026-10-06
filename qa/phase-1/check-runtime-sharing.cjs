#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const webpack = require("webpack");

const repoRoot = path.resolve(__dirname, "../..");
const fixtureRoot = path.join(repoRoot, "qa/fixtures/runtime-sharing");

function compileFixture(outputPath) {
  const config = {
    mode: "development",
    context: fixtureRoot,
    entry: {
      shell: "./shell-entry.js",
      page: "./page-entry.js",
    },
    output: {
      path: outputPath,
      filename: "[name].js",
      chunkFilename: "chunks/[name].js",
      publicPath: "/",
      globalObject: "globalThis",
      uniqueName: "phase1RuntimeSharingFixture",
    },
    optimization: {
      minimize: false,
      runtimeChunk: "single",
      splitChunks: { chunks: "all", minSize: 0 },
    },
    devtool: false,
    target: "web",
  };

  return new Promise((resolve, reject) => {
    webpack(config, (error, stats) => {
      if (error) {
        reject(error);
        return;
      }
      if (!stats) {
        reject(new Error("Webpack returned no stats for the runtime fixture."));
        return;
      }
      if (stats.hasErrors()) {
        reject(new Error(stats.toString({ all: false, errors: true, errorDetails: true })));
        return;
      }
      resolve(stats.toJson({ assets: true, chunks: true, entrypoints: true, modules: true }));
    });
  });
}

function readEntrypointAssets(stats, name) {
  const entrypoint = stats.entrypoints[name];
  assert.ok(entrypoint, `Webpack must report the ${name} entrypoint.`);
  return entrypoint.assets.map((asset) => (typeof asset === "string" ? asset : asset.name));
}

function executeBuiltEntries(outputPath, assetNames) {
  const context = vm.createContext({ console, setTimeout, clearTimeout });
  context.globalThis = context;
  context.self = context;
  for (const assetName of assetNames) {
    const assetPath = path.join(outputPath, assetName);
    assert.ok(fs.existsSync(assetPath), `Expected emitted fixture asset ${assetName}.`);
    vm.runInContext(fs.readFileSync(assetPath, "utf8"), context, { filename: assetName });
  }
  return context;
}

async function main() {
  const outputPath = fs.mkdtempSync(path.join(os.tmpdir(), "framework-runtime-sharing-"));
  try {
    const stats = await compileFixture(outputPath);
    const runtimeAssets = stats.assets.map((asset) => asset.name).filter((name) => /(?:^|\/)runtime(?:\.[^.]+)?\.js$/.test(name));
    assert.equal(runtimeAssets.length, 1, "two entries must share exactly one emitted runtime asset.");
    for (const name of ["shell", "page"]) {
      const assets = readEntrypointAssets(stats, name);
      assert.equal(assets.filter((asset) => asset === runtimeAssets[0]).length, 1, `${name} must load the single runtime exactly once.`);
    }

    const sharedModules = stats.modules.filter((module) => module.name?.endsWith("/shared-state.js"));
    assert.equal(sharedModules.length, 1, "Webpack's module graph must contain one shared stateful module.");
    const emittedJavaScript = stats.assets
      .map((asset) => asset.name)
      .filter((name) => name.endsWith(".js"))
      .map((name) => fs.readFileSync(path.join(outputPath, name), "utf8"))
      .join("\n");
    assert.equal(emittedJavaScript.split("state.evaluations += 1;").length - 1, 1, "the shared state module's initialization code must be emitted exactly once.");
    const sharedModuleChunks = new Set(sharedModules[0].chunks || []);
    assert.equal(sharedModuleChunks.size, 1, "the shared module must be emitted in exactly one shared chunk.");
    for (const name of ["shell", "page"]) {
      assert.ok(stats.entrypoints[name].chunks.some((chunk) => sharedModuleChunks.has(chunk)), `${name} must depend on the one shared module chunk.`);
    }

    const executionAssets = [...new Set([
      ...readEntrypointAssets(stats, "shell"),
      ...readEntrypointAssets(stats, "page"),
    ])];
    const context = executeBuiltEntries(outputPath, executionAssets);
    assert.deepEqual({ ...context.__runtimeFixtureState }, { evaluations: 1, mounts: 1 }, "the stateful shared module must initialize and mount once across both entries.");
    assert.deepEqual({ ...context.__runtimeFixtureEntries }, { shell: 1, page: 1 }, "both entry modules must execute.");

    process.stdout.write(`Two-entry runtime sharing passed: ${runtimeAssets[0]} loads once per entry; shared module evaluates/mounts once; both entries execute.\n`);
  } finally {
    fs.rmSync(outputPath, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
