#!/usr/bin/env node
/**
 * Minimal production bootstrap for the local-only dictation fork.
 * Downloads only what the packaged app needs — no qdrant, llama, meetings, etc.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function binExists(fragment) {
  const binDir = path.join(root, "resources", "bin");
  if (!fs.existsSync(binDir)) return false;
  return fs.readdirSync(binDir).some((name) => name.includes(fragment));
}

function run(script, { optional = false } = {}) {
  console.log(`\n[local-pack] → npm run ${script}`);
  const result = spawnSync("npm", ["run", script], {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    if (optional) {
      console.warn(`[local-pack] ⚠ ${script} failed (optional — continuing)`);
      return;
    }
    process.exit(result.status ?? 1);
  }
}

function ensureWhisperCpp() {
  const hasServer = binExists("whisper-server");
  if (hasServer) {
    console.log("[local-pack] whisper-server binary already present — skipping download");
    return;
  }
  run("download:whisper-cpp");
}

function syncAppIcons() {
  run("sync:icons", { optional: true });
}

console.log("[local-pack] Preparing local dictation production build…");

syncAppIcons();

if (process.platform === "linux") {
  run("compile:linuxkeys");
  run("compile:linux-paste", { optional: true });
} else if (process.platform === "win32") {
  run("compile:winkeys");
  run("download:windows-key-listener", { optional: true });
  run("download:nircmd", { optional: true });
} else if (process.platform === "darwin") {
  run("compile:globe");
  run("compile:fast-paste", { optional: true });
}

ensureWhisperCpp();

console.log("\n[local-pack] Done. Run npm run build:local:appimage to create the installable app.\n");
