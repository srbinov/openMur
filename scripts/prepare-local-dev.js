#!/usr/bin/env node
/**
 * Minimal dev bootstrap for the local-only dictation fork.
 * Skips qdrant, embeddings, meetings, diarization, and other cloud-only features.
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
  console.log(`\n[local-dev] → npm run ${script}`);
  const result = spawnSync("npm", ["run", script], {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    if (optional) {
      console.warn(`[local-dev] ⚠ ${script} failed (optional — continuing)`);
      return;
    }
    process.exit(result.status ?? 1);
  }
}

function ensureWhisperCpp() {
  const hasServer = binExists("whisper-server");
  if (hasServer) {
    console.log("[local-dev] whisper-server binary already present — skipping download");
    return;
  }
  run("download:whisper-cpp");
}

function ensureWhisperVad() {
  const vadPath = path.join(root, "resources", "bin", "whisper-vad", "ggml-silero-v5.1.2.bin");
  if (fs.existsSync(vadPath)) {
    console.log("[local-dev] whisper VAD model already present — skipping download");
    return;
  }
  run("download:whisper-vad-model");
}

function syncAppIcons() {
  run("sync:icons", { optional: true });
}

console.log("[local-dev] openMur — same app as packaged build, with Vite hot reload");
console.log("[local-dev] Preparing dev environment…");

syncAppIcons();

if (process.platform === "linux") {
  run("compile:linuxkeys");
  run("compile:linux-paste", { optional: true });
} else if (process.platform === "win32") {
  run("compile:winkeys");
  run("compile:winpaste", { optional: true });
} else if (process.platform === "darwin") {
  run("compile:globe");
  run("compile:fast-paste", { optional: true });
}

ensureWhisperCpp();
ensureWhisperVad();

console.log("\n[local-dev] Done.\n");
