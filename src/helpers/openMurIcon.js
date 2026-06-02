const { app, nativeImage } = require("electron");
const fs = require("fs");
const path = require("path");

/** Master artwork — run `npm run sync:icons` to refresh src/assets/icon*.png */
const SOURCE_ICON = "openMurIcon.png";

/** Resized copies for Linux taskbar/packaging (generated from openMurIcon.png via npm run sync:icons). */
const PACKAGED_ICONS = ["icon-256.png", "icon.png", "icon-128.png"];

function getHelpersDir() {
  return __dirname;
}

function getAppRoot() {
  return app?.getAppPath?.() || path.join(getHelpersDir(), "..", "..");
}

/** Your upload — always preferred over generated src/assets/icon*.png */
function resolveSourceIconPaths() {
  const helpersDir = getHelpersDir();
  const appPath = getAppRoot();
  return [
    path.join(helpersDir, "assets", SOURCE_ICON),
    path.join(appPath, "src", "helpers", "assets", SOURCE_ICON),
  ];
}

function resolvePackagedIconPaths() {
  const helpersDir = getHelpersDir();
  const appPath = getAppRoot();
  const isDev = process.env.NODE_ENV === "development";

  const paths = [];
  for (const name of PACKAGED_ICONS) {
    paths.push(
      path.join(helpersDir, "..", "assets", name),
      path.join(appPath, "src", "assets", name)
    );
  }

  if (!isDev && process.resourcesPath) {
    for (const name of PACKAGED_ICONS) {
      paths.push(
        path.join(process.resourcesPath, "src", "assets", name),
        path.join(process.resourcesPath, "app.asar.unpacked", "src", "assets", name)
      );
    }
  }

  return paths;
}

function resolveOpenMurIconPath() {
  for (const iconPath of resolveSourceIconPaths()) {
    if (fs.existsSync(iconPath)) return iconPath;
  }
  for (const iconPath of resolvePackagedIconPaths()) {
    if (fs.existsSync(iconPath)) return iconPath;
  }
  return null;
}

function defaultLinuxIconSize() {
  return 256;
}

/**
 * @param {{ size?: number, template?: boolean }} [options]
 */
function loadOpenMurIcon(options = {}) {
  const iconPath = resolveOpenMurIconPath();
  if (!iconPath) return null;

  try {
    let image = nativeImage.createFromPath(iconPath);
    if (!image || image.isEmpty()) return null;

    let size = options.size;
    if (size == null && process.platform === "linux") {
      size = defaultLinuxIconSize();
    }

    if (size && size > 0) {
      const { width, height } = image.getSize();
      if (width > size || height > size) {
        image = image.resize({ width: size, height: size, quality: "best" });
      }
    }

    if (process.platform === "darwin" && options.template) {
      image.setTemplateImage(true);
    }

    return image;
  } catch {
    return null;
  }
}

/** Path string for BrowserWindow `icon` option (Linux taskbar reads this at create time). */
function getOpenMurWindowIconPath() {
  return resolveOpenMurIconPath();
}

function applyOpenMurWindowIcon(win) {
  if (!win || win.isDestroyed()) return;
  const iconPath = getOpenMurWindowIconPath();
  if (iconPath) {
    try {
      win.setIcon(iconPath);
      return;
    } catch {
      // fall through to NativeImage
    }
  }
  const image = loadOpenMurIcon();
  if (!image) return;
  try {
    win.setIcon(image);
  } catch {
    // ignore
  }
}

function applyOpenMurAppIcon() {
  const image = loadOpenMurIcon({ size: process.platform === "linux" ? 256 : undefined });
  if (!image || typeof app?.setIcon !== "function") return;
  try {
    app.setIcon(image);
  } catch {
    // ignore
  }
}

function loadOpenMurTrayIcon() {
  if (process.platform === "darwin") {
    return loadOpenMurIcon({ size: 22, template: true });
  }
  return loadOpenMurIcon({ size: 32 });
}

module.exports = {
  SOURCE_ICON,
  PACKAGED_ICONS,
  resolveOpenMurIconPath,
  resolvePackagedIconPaths,
  loadOpenMurIcon,
  loadOpenMurTrayIcon,
  getOpenMurWindowIconPath,
  applyOpenMurWindowIcon,
  applyOpenMurAppIcon,
};
