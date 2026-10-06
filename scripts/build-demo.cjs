#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { PROFILES } = require("../config/build.config.cjs");

function main(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write("Usage: yarn build:demo <agency|saas> [--profile <profile>]\n\nUses customer-production by default. BASE_PATH, SITE_URL, and BUILD_NOW\nare the same inputs as yarn build. Available profiles: " + Object.keys(PROFILES).join(", ") + ".\n");
    return 0;
  }

  const [demo, ...options] = argv;
  if (!["agency", "saas"].includes(demo)) {
    throw new Error("Choose a completed demo: yarn build:demo <agency|saas>.");
  }
  let profile = process.env.BUILD_PROFILE || "customer-production";
  if (options.length) {
    if (options.length !== 2 || options[0] !== "--profile" || !Object.hasOwn(PROFILES, options[1])) {
      throw new Error("Use --profile followed by one of: " + Object.keys(PROFILES).join(", ") + ".");
    }
    profile = options[1];
  }
  if (!Object.hasOwn(PROFILES, profile)) throw new Error(`Unknown BUILD_PROFILE: ${profile}.`);

  const result = spawnSync(process.execPath, [
    require.resolve("webpack-cli/bin/cli.js"), "build", "--mode", PROFILES[profile].mode,
    "--env", `demo=${demo}`, "--env", `profile=${profile}`,
  ], { cwd: path.resolve(__dirname, ".."), env: process.env, stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
