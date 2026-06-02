#!/usr/bin/env node
/**
 * Fails CI/local checks if API keys or hardcoded secrets appear in source.
 * Run: npm run check:secrets
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SCAN_DIRS = ["src", "main.js", "preload.js", "scripts"];
const SKIP = new Set(["check-no-secrets.js", "reinstall-installed-openmur.sh"]);

const PATTERNS = [
  { name: "Anthropic API key", re: /sk-ant-api[0-9A-Za-z_-]{20,}/ },
  { name: "OpenAI API key", re: /sk-proj-[0-9A-Za-z_-]{20,}/ },
  { name: "Hardcoded secret constant", re: /HARDCODED_.*API_KEY/ },
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const stat = fs.statSync(dir);
  if (stat.isFile()) {
    if (/\.(js|ts|tsx|jsx|json|mjs|cjs)$/.test(dir)) files.push(dir);
    return files;
  }
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    walk(path.join(dir, name), files);
  }
  return files;
}

function collectFiles() {
  const files = [];
  for (const entry of SCAN_DIRS) {
    const full = path.join(ROOT, entry);
    if (fs.existsSync(full)) {
      if (fs.statSync(full).isFile()) files.push(full);
      else walk(full, files);
    }
  }
  return files;
}

function main() {
  const hits = [];
  for (const file of collectFiles()) {
    if (SKIP.has(path.basename(file))) continue;
    const rel = path.relative(ROOT, file);
    const text = fs.readFileSync(file, "utf8");
    for (const { name, re } of PATTERNS) {
      if (re.test(text)) hits.push({ rel, name });
    }
  }

  if (hits.length) {
    console.error("[check:secrets] Possible secrets in repository:\n");
    for (const { rel, name } of hits) {
      console.error(`  ${rel} — ${name}`);
    }
    console.error("\nRemove keys from source. Use Settings or ~/.config/openmur secure storage.");
    process.exit(1);
  }

  console.log("[check:secrets] OK — no API key patterns in scanned source.");
}

main();
