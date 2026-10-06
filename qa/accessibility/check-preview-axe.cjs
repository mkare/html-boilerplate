#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "../..");
const webpackCli = path.join(projectRoot, "node_modules/webpack-cli/bin/cli.js");
const previewServerScript = path.join(projectRoot, "scripts/preview.cjs");
const axeScanner = path.join(__dirname, "run-axe.cjs");
const manifestPath = path.join(projectRoot, ".generated/pages-manifest.json");
const defaultBuildNow = "2026-10-03T12:00:00.000Z";
const startupTimeoutMs = 20_000;
const serverStopTimeoutMs = 5_000;

let activeChild = null;
let activePhase = "preview";
let receivedSignal = null;

class ChildProcessFailure extends Error {
  constructor(label, result) {
    const detail = result.error
      ? result.error.message
      : result.signal
        ? `terminated by ${result.signal}`
        : `exit code ${result.code}`;
    super(`${label} failed (${detail}).`);
    this.name = "ChildProcessFailure";
    this.code = Number.isInteger(result.code) && result.code !== 0 ? result.code : 1;
  }
}

function onSignal(signal) {
  if (!receivedSignal) receivedSignal = signal;
  if (activePhase !== "restore" && activeChild && !activeChild.killed) {
    activeChild.kill(signal);
  }
}

process.on("SIGINT", onSignal);
process.on("SIGTERM", onSignal);

function announce(message) {
  process.stdout.write(`Accessibility CI: ${message}\n`);
}

function childEnvironment(overrides = {}) {
  return { ...process.env, ...overrides };
}

function runChild(args, env, label) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(process.execPath, args, {
        cwd: projectRoot,
        env,
        stdio: "inherit",
      });
    } catch (error) {
      reject(new ChildProcessFailure(label, { error }));
      return;
    }

    activeChild = child;
    let spawnError = null;
    child.once("error", (error) => {
      spawnError = error;
    });
    child.once("close", (code, signal) => {
      if (activeChild === child) activeChild = null;
      const result = { code, signal, error: spawnError };
      if (spawnError || code !== 0 || signal) reject(new ChildProcessFailure(label, result));
      else resolve();
    });
  });
}

function previewBuildArgs(profile, demo) {
  const args = [webpackCli, "build", "--mode", "production", "--config", "webpack.config.js"];
  args.push("--env", `profile=${profile}`);
  if (demo) args.push("--env", `demo=${demo}`);
  return args;
}

function previewEnvironment(buildNow) {
  const env = childEnvironment({ BUILD_NOW: buildNow, BUILD_PROFILE: "catalog-preview" });
  // The catalog is multi-demo. An explicit BUILD_DEMO would turn it into a selected package build.
  delete env.BUILD_DEMO;
  return env;
}

function customerEnvironment(buildNow) {
  return childEnvironment({
    BUILD_DEMO: "saas",
    BUILD_PROFILE: "customer-production",
    BUILD_NOW: buildNow,
  });
}

function readManifestBasePath() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error("The preview build did not produce .generated/pages-manifest.json.");
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const basePath = manifest.site?.basePath;
  if (typeof basePath !== "string" || !basePath.startsWith("/") || !basePath.endsWith("/")) {
    throw new Error("The preview manifest has an invalid site.basePath.");
  }
  return basePath;
}

function allocateLoopbackPort() {
  return new Promise((resolve, reject) => {
    const reservation = net.createServer();
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", () => {
      const address = reservation.address();
      if (!address || typeof address === "string") {
        reservation.close(() => reject(new Error("Could not allocate a loopback preview port.")));
        return;
      }
      reservation.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

function spawnPreviewServer(port, env) {
  const child = spawn(process.execPath, [previewServerScript], {
    cwd: projectRoot,
    env: { ...env, PORT: String(port) },
    stdio: "inherit",
  });
  const state = { child, closed: false, result: null, error: null, exitPromise: null };
  state.exitPromise = new Promise((resolve) => {
    child.once("error", (error) => {
      state.error = error;
    });
    child.once("close", (code, signal) => {
      state.closed = true;
      state.result = { code, signal };
      if (activeChild === child) activeChild = null;
      resolve(state.result);
    });
  });
  activeChild = child;
  return state;
}

function waitForExit(state, timeoutMs) {
  if (state.closed) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    state.exitPromise.then(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function stopPreviewServer(state) {
  if (state.closed) return;
  state.child.kill("SIGTERM");
  if (await waitForExit(state, serverStopTimeoutMs)) return;
  state.child.kill("SIGKILL");
  if (await waitForExit(state, 2_000)) return;
  throw new Error("The preview server did not exit after SIGTERM and SIGKILL.");
}

function probe(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      response.resume();
      response.once("end", () => resolve(response.statusCode || 0));
      response.once("error", reject);
    });
    request.setTimeout(2_000, () =>
      request.destroy(new Error("Preview readiness probe timed out.")),
    );
    request.once("error", reject);
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForPreview(state, url) {
  const deadline = Date.now() + startupTimeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    if (state.closed) {
      const reason =
        state.error?.message || state.result?.signal || `exit code ${state.result?.code}`;
      throw new Error(`Preview server exited before becoming ready (${reason}).`);
    }
    if (receivedSignal) throw new Error(`Interrupted by ${receivedSignal} during preview startup.`);
    try {
      await probe(url);
      return;
    } catch (error) {
      lastError = error;
      await delay(200);
    }
  }
  throw new Error(
    `Preview server did not become ready within ${startupTimeoutMs} ms${lastError ? `: ${lastError.message}` : "."}`,
  );
}

function displayError(label, error) {
  const message = error?.message || String(error);
  process.stderr.write(`Accessibility CI: ${label}: ${message}\n`);
}

async function main() {
  const buildNow = process.env.BUILD_NOW?.trim() || defaultBuildNow;
  let previewFailure = null;
  let serverState = null;
  const restorationFailures = [];

  try {
    if (!fs.existsSync(webpackCli)) throw new Error(`webpack-cli was not found at ${webpackCli}.`);
    if (!fs.existsSync(axeScanner))
      throw new Error(`The axe scanner was not found at ${axeScanner}.`);
    const env = previewEnvironment(buildNow);
    activePhase = "preview";
    announce(`building catalog-preview with BUILD_NOW=${buildNow}`);
    await runChild(previewBuildArgs("catalog-preview"), env, "catalog-preview build");

    const basePath = readManifestBasePath();
    const port = await allocateLoopbackPort();
    const baseURL = `http://127.0.0.1:${port}${basePath}`;
    announce(`starting local preview at ${baseURL}`);
    serverState = spawnPreviewServer(port, env);
    await waitForPreview(serverState, baseURL);
    await runChild([axeScanner, baseURL], env, "all-route axe scan");
  } catch (error) {
    previewFailure = error;
  } finally {
    if (serverState) {
      try {
        await stopPreviewServer(serverState);
      } catch (error) {
        restorationFailures.push(new Error(`preview server shutdown: ${error.message}`));
      }
    }

    activePhase = "restore";
    const env = customerEnvironment(buildNow);
    announce(`restoring SaaS customer-production with BUILD_NOW=${buildNow}`);
    let restorationBuildSucceeded = false;
    try {
      await runChild(
        previewBuildArgs("customer-production", "saas"),
        env,
        "SaaS customer build restore",
      );
      restorationBuildSucceeded = true;
    } catch (error) {
      restorationFailures.push(error);
    }
    if (restorationBuildSucceeded) {
      const profileEnv = {
        ...env,
        EXPECTED_DEMO: "saas",
        EXPECTED_PROFILE: "customer-production",
      };
      delete profileEnv.EXPECTED_BASE_PATH;
      for (const [script, label, checkEnv] of [
        [path.join(projectRoot, "qa/check-dist.cjs"), "restored customer dist check", env],
        [
          path.join(projectRoot, "qa/phase-5/check-profile.cjs"),
          "restored SaaS customer profile check",
          profileEnv,
        ],
      ]) {
        try {
          await runChild([script], checkEnv, label);
        } catch (error) {
          restorationFailures.push(error);
        }
      }
      if (restorationFailures.length === 0)
        announce("SaaS customer-production output restored and verified.");
    }
  }

  process.off("SIGINT", onSignal);
  process.off("SIGTERM", onSignal);

  if (previewFailure) displayError("preview/axe acceptance failed", previewFailure);
  for (const failure of restorationFailures) displayError("restore verification failed", failure);
  if (receivedSignal)
    displayError(
      "interrupted",
      new Error(`received ${receivedSignal}; customer restore was attempted`),
    );

  if (previewFailure || restorationFailures.length || receivedSignal) {
    process.exitCode = previewFailure?.code || 1;
    return;
  }
  announce("all-route axe acceptance passed.");
}

main().catch((error) => {
  process.off("SIGINT", onSignal);
  process.off("SIGTERM", onSignal);
  displayError("unexpected wrapper failure", error);
  process.exitCode = 1;
});
