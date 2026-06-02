const { spawnSync } = require("child_process");

function commandExists(cmd) {
  try {
    return spawnSync("which", [cmd], { encoding: "utf8", timeout: 500 }).status === 0;
  } catch {
    return false;
  }
}

function parseXdotoolGeometry(output) {
  const vars = {};
  for (const line of output.split("\n")) {
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = parseInt(line.slice(eq + 1).trim(), 10);
    if (Number.isFinite(value)) vars[key] = value;
  }

  const x = vars.X ?? vars.WINDOWX;
  const y = vars.Y ?? vars.WINDOWY;
  const width = vars.WIDTH;
  const height = vars.HEIGHT;

  if ([x, y, width, height].every(Number.isFinite)) {
    return { x: x + Math.round(width / 2), y: y + Math.round(height / 2) };
  }

  return null;
}

function isOpenMurWindowClass(className) {
  if (!className) return false;
  const normalized = className.toLowerCase();
  return (
    normalized.includes("openmur") ||
    normalized.includes("openmur") ||
    normalized.includes("electron") ||
    normalized.includes("voice recorder")
  );
}

function getLinuxActiveWindowAnchor() {
  if (!commandExists("xdotool")) return null;

  try {
    const winResult = spawnSync("xdotool", ["getactivewindow"], {
      encoding: "utf8",
      timeout: 500,
    });
    if (winResult.status !== 0) return null;

    const windowId = winResult.stdout.trim();
    if (!windowId || windowId === "0") return null;

    const classResult = spawnSync("xdotool", ["getwindowclassname", windowId], {
      encoding: "utf8",
      timeout: 500,
    });
    const windowClass =
      classResult.status === 0 ? classResult.stdout.trim().toLowerCase() : null;
    if (isOpenMurWindowClass(windowClass)) {
      return { skipped: true, reason: "own-window" };
    }

    const geoResult = spawnSync("xdotool", ["getwindowgeometry", "--shell", windowId], {
      encoding: "utf8",
      timeout: 500,
    });
    if (geoResult.status !== 0) return null;

    const point = parseXdotoolGeometry(geoResult.stdout);
    return point ? { ...point, source: "xdotool" } : null;
  } catch {
    return null;
  }
}

function getHyprlandActiveWindowAnchor() {
  if (!process.env.HYPRLAND_INSTANCE_SIGNATURE || !commandExists("hyprctl")) return null;

  try {
    const result = spawnSync("hyprctl", ["activewindow", "-j"], {
      encoding: "utf8",
      timeout: 500,
    });
    if (result.status !== 0) return null;

    const data = JSON.parse(result.stdout);
    const className = (data.class || data.initialClass || "").toLowerCase();
    if (isOpenMurWindowClass(className)) {
      return { skipped: true, reason: "own-window" };
    }

    if (Array.isArray(data.at) && Array.isArray(data.size)) {
      return {
        x: data.at[0] + Math.round(data.size[0] / 2),
        y: data.at[1] + Math.round(data.size[1] / 2),
        source: "hyprctl",
      };
    }
  } catch {
    return null;
  }

  return null;
}

class PillAnchorTracker {
  constructor() {
    this._lastExternalAnchor = null;
  }

  reset() {
    this._lastExternalAnchor = null;
  }

  /**
   * Returns the best screen point for anchoring the dictation pill.
   * Prefers the active/focused window's position so the pill appears on the
   * same monitor as the window the user is typing in.
   */
  resolve(screenModule, options = {}) {
    const cursor = screenModule.getCursorScreenPoint();
    if (options.preferCursor) {
      return cursor;
    }

    let anchor = null;

    if (process.platform === "linux") {
      const onHyprland = !!process.env.HYPRLAND_INSTANCE_SIGNATURE;
      const onGnomeWayland =
        process.env.XDG_SESSION_TYPE === "wayland" &&
        /gnome|ubuntu|unity/i.test(process.env.XDG_CURRENT_DESKTOP || "");

      if (onHyprland) {
        // hyprctl reliably reports the active window on Hyprland
        anchor = getHyprlandActiveWindowAnchor();
      } else if (!onGnomeWayland) {
        // X11: xdotool reliably reports the active window
        anchor = getLinuxActiveWindowAnchor();
      }
      // GNOME Wayland: xdotool reports the primary monitor incorrectly — fall through to cursor
    }

    if (anchor?.skipped) {
      anchor = null;
    }

    if (anchor?.x != null && anchor?.y != null) {
      this._lastExternalAnchor = { x: anchor.x, y: anchor.y };
      return this._lastExternalAnchor;
    }

    return cursor;
  }
}

module.exports = {
  PillAnchorTracker,
  getLinuxActiveWindowAnchor,
  getHyprlandActiveWindowAnchor,
  isOpenMurWindowClass,
};
