const { app } = require("electron");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { getAppBrand } = require("./appBrand");
const { resolveOpenMurIconPath } = require("./openMurIcon");

const SYSTEM_INSTALL_EXEC = "/opt/openMur/openmur";
const SYSTEM_DESKTOP_PATH = "/usr/share/applications/openmur.desktop";

const brand = getAppBrand();
const DESKTOP_BASENAME = brand.desktopFile;
const STARTUP_WM_CLASS = DESKTOP_BASENAME.replace(/\.desktop$/i, "");

function getApplicationsDesktopPath() {
  return path.join(os.homedir(), ".local", "share", "applications", DESKTOP_BASENAME);
}

function getAutostartDesktopPath() {
  return path.join(os.homedir(), ".config", "autostart", `${brand.id}-dictation.desktop`);
}

function buildLaunchExec({ appPath, execPath }) {
  if (process.env.APPIMAGE) {
    return `"${process.env.APPIMAGE}" --ozone-platform=x11`;
  }
  const args = [`"${execPath}"`, `"${appPath}"`, "--ozone-platform=x11"];
  if (process.env.NODE_ENV === "development") {
    args.push("--no-sandbox");
  }
  return args.join(" ");
}

function buildDesktopEntry({ appName, exec, iconPath, autostart = false }) {
  const lines = [
    "[Desktop Entry]",
    "Type=Application",
    "Version=1.0",
    `Name=${appName}`,
    "Comment=Local dictation — hold hotkey to speak",
    `Exec=${exec}`,
    `Icon=${iconPath}`,
    "Terminal=false",
    "Categories=Utility;Audio;",
    `StartupWMClass=${STARTUP_WM_CLASS}`,
    "StartupNotify=false",
  ];
  if (autostart) {
    lines.push("X-GNOME-Autostart-enabled=true", "Hidden=false");
  }
  return `${lines.join("\n")}\n`;
}

function refreshDesktopDatabase() {
  const appsDir = path.join(os.homedir(), ".local", "share", "applications");
  spawnSync("update-desktop-database", [appsDir], { stdio: "ignore" });
  for (const cmd of ["kbuildsycoca6", "kbuildsycoca5"]) {
    spawnSync(cmd, ["--cache-only"], { stdio: "ignore" });
  }
}

function writeDesktopFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, { mode: 0o644 });
}

/**
 * KDE/GNOME taskbar icons come from a .desktop file (Icon + StartupWMClass), not setIcon().
 * Dev runs as the Electron binary, so install ~/.local/share/applications/open-mur.desktop.
 */
function installLinuxApplicationDesktop({ appPath, execPath, appName = brand.displayName }) {
  const iconPath = resolveOpenMurIconPath();
  if (!iconPath) {
    return { success: false, reason: "icon-missing" };
  }

  const exec = buildLaunchExec({ appPath, execPath });
  const content = buildDesktopEntry({
    appName,
    exec,
    iconPath: path.resolve(iconPath),
    autostart: false,
  });

  const desktopPath = getApplicationsDesktopPath();
  writeDesktopFile(desktopPath, content);
  refreshDesktopDatabase();
  return { success: true, path: desktopPath };
}

function installLinuxAutostart(appName = brand.displayName, { appPath, execPath } = {}) {
  if (process.platform !== "linux") return { success: false, reason: "not-linux" };

  const iconPath = resolveOpenMurIconPath();
  if (!iconPath) {
    return { success: false, reason: "icon-missing" };
  }

  const resolvedAppPath = appPath || path.join(__dirname, "..", "..");
  const resolvedExecPath = execPath || process.execPath;
  const exec = buildLaunchExec({ appPath: resolvedAppPath, execPath: resolvedExecPath });
  const content = buildDesktopEntry({
    appName,
    exec,
    iconPath: path.resolve(iconPath),
    autostart: true,
  });

  const desktopPath = getAutostartDesktopPath();
  writeDesktopFile(desktopPath, content);
  return { success: true, path: desktopPath };
}

function isLinuxAutostartEnabled() {
  if (process.platform !== "linux") return false;
  return fs.existsSync(getAutostartDesktopPath());
}

function removeLinuxAutostart() {
  if (process.platform !== "linux") return { success: false, reason: "not-linux" };
  const desktopPath = getAutostartDesktopPath();
  if (fs.existsSync(desktopPath)) {
    fs.unlinkSync(desktopPath);
  }
  return { success: true };
}

function removeLinuxDevApplicationDesktop() {
  if (process.platform !== "linux") return { success: false, reason: "not-linux" };
  const desktopPath = getApplicationsDesktopPath();
  if (fs.existsSync(desktopPath)) {
    fs.unlinkSync(desktopPath);
    refreshDesktopDatabase();
  }
  return { success: true };
}

function isSystemOpenMurInstalled() {
  if (process.platform !== "linux") return false;
  return (
    fs.existsSync(SYSTEM_INSTALL_EXEC) ||
    fs.existsSync(SYSTEM_DESKTOP_PATH)
  );
}

function shouldInstallUserDesktopEntry() {
  if (process.platform !== "linux") return false;
  if (process.env.APPIMAGE) return false;
  if (app?.isPackaged) return false;
  if (isSystemOpenMurInstalled()) return false;
  return Boolean(process.defaultApp || process.env.NODE_ENV === "development");
}

/**
 * Wire taskbar icon + autostart .desktop entries for local dev (npm run dev).
 */
function ensureLinuxDesktopIntegration({ appPath, execPath, appName = brand.displayName } = {}) {
  if (process.platform !== "linux") return { application: null, autostart: null };

  const packaged = Boolean(app?.isPackaged);
  const systemInstalled = isSystemOpenMurInstalled();

  if (packaged || systemInstalled) {
    removeLinuxDevApplicationDesktop();
  }

  let application = null;
  if (shouldInstallUserDesktopEntry() && appPath && execPath) {
    application = installLinuxApplicationDesktop({ appPath, execPath, appName });
  }

  let autostart = null;
  if (packaged) {
    autostart = installLinuxAutostart(appName, { appPath, execPath });
  } else if (systemInstalled) {
    autostart = removeLinuxAutostart();
  }

  return { application, autostart };
}

module.exports = {
  DESKTOP_BASENAME,
  STARTUP_WM_CLASS,
  getApplicationsDesktopPath,
  getAutostartDesktopPath,
  buildLaunchExec,
  installLinuxApplicationDesktop,
  installLinuxAutostart,
  isLinuxAutostartEnabled,
  removeLinuxAutostart,
  removeLinuxDevApplicationDesktop,
  isSystemOpenMurInstalled,
  shouldInstallUserDesktopEntry,
  ensureLinuxDesktopIntegration,
};
