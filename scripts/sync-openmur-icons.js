#!/usr/bin/env node
/**
 * Build taskbar/packaging icons from the canonical upload (openMurIcon.png).
 * Linux/KDE reliably uses src/assets/icon.png at 256–512px — not 2000px sources.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const source = path.join(root, "src", "helpers", "assets", "openMurIcon.png");
const assetsDir = path.join(root, "src", "assets");

const outputs = [
  { file: "icon.png", size: 512 },
  { file: "icon-256.png", size: 256 },
  { file: "icon-128.png", size: 128 },
];

function resizeWithConvert(size, dest) {
  const result = spawnSync(
    "convert",
    [source, "-resize", `${size}x${size}`, "-strip", dest],
    { stdio: "pipe" }
  );
  return result.status === 0;
}

function resizeWithPil(size, dest) {
  try {
    // eslint-disable-next-line import/no-extraneous-dependencies
    const { execSync } = require("child_process");
    execSync(
      `python3 -c "from PIL import Image; im=Image.open(${JSON.stringify(source)}); im.resize((${size},${size}), Image.Resampling.LANCZOS).save(${JSON.stringify(dest)})"`,
      { stdio: "inherit" }
    );
    return true;
  } catch {
    return false;
  }
}

function main() {
  if (!fs.existsSync(source)) {
    console.error(`[sync-icons] Missing source: ${source}`);
    process.exit(1);
  }

  fs.mkdirSync(assetsDir, { recursive: true });

  for (const { file, size } of outputs) {
    const dest = path.join(assetsDir, file);
    const ok = resizeWithConvert(size, dest) || resizeWithPil(size, dest);
    if (!ok) {
      console.error(`[sync-icons] Failed to write ${dest}`);
      process.exit(1);
    }
    console.log(`[sync-icons] ${path.relative(root, dest)} (${size}×${size})`);
  }

  console.log(
    "[sync-icons] Done — resized from src/helpers/assets/openMurIcon.png (your upload) into src/assets/"
  );
}

main();
