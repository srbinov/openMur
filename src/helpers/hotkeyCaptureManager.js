/**
 * HotkeyCaptureManager - OS-level hotkey capture during hotkey listening mode.
 *
 * Uses the native low-level keyboard listener (--capture mode) when available,
 * with before-input-event as a fallback for modifier combos the renderer can't see.
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const debugLogger = require("./debugLogger");
const {
  createHotkeyCaptureState,
  resetHotkeyCaptureState,
  handleNativeCaptureInput,
  shouldDedupeCapture,
} = require("./hotkeyCaptureBridge");

class HotkeyCaptureManager {
  constructor() {
    this.process = null;
    this.webContents = null;
    this.beforeInputHandler = null;
    this.captureState = null;
    this.enabled = false;
    this.lineBuffer = "";
  }

  start(windowManager) {
    this.stop(windowManager);

    const win = windowManager?.controlPanelWindow;
    if (!win || win.isDestroyed()) {
      this.enabled = true;
      return;
    }

    this.enabled = true;
    this.webContents = win.webContents;
    this.captureState = createHotkeyCaptureState();

    this._startNativeListener();
    this._startBeforeInputFallback();
  }

  stop(_windowManager) {
    this.enabled = false;
    this._stopNativeListener();
    this._stopBeforeInputFallback();
    if (this.captureState) {
      resetHotkeyCaptureState(this.captureState);
      this.captureState = null;
    }
    this.webContents = null;
  }

  _emitHotkey(hotkey) {
    if (!hotkey || !this.enabled) return;
    if (this.captureState && shouldDedupeCapture(this.captureState, hotkey)) {
      return;
    }

    debugLogger.log(`[HotkeyCaptureManager] Captured hotkey: ${hotkey}`);
    if (this.webContents && !this.webContents.isDestroyed()) {
      this.webContents.send("native-hotkey-captured", hotkey);
    }
  }

  _resolveNativeBinary() {
    const platform = process.platform;
    if (platform === "win32") {
      const binaryName = "windows-key-listener.exe";
      return this._findBinary(binaryName);
    }
    if (platform === "linux") {
      const arch = process.arch;
      const withArch = this._findBinary(`linux-key-listener-${platform}-${arch}`);
      if (withArch) return withArch;
      return this._findBinary("linux-key-listener");
    }
    return null;
  }

  _findBinary(binaryName) {
    const candidates = new Set([
      path.join(__dirname, "..", "..", "resources", "bin", binaryName),
      path.join(__dirname, "..", "..", "resources", binaryName),
    ]);

    if (process.resourcesPath) {
      [
        path.join(process.resourcesPath, binaryName),
        path.join(process.resourcesPath, "bin", binaryName),
        path.join(process.resourcesPath, "resources", binaryName),
        path.join(process.resourcesPath, "resources", "bin", binaryName),
        path.join(process.resourcesPath, "app.asar.unpacked", "resources", binaryName),
        path.join(process.resourcesPath, "app.asar.unpacked", "resources", "bin", binaryName),
      ].forEach((candidate) => candidates.add(candidate));
    }

    for (const candidate of candidates) {
      try {
        if (fs.statSync(candidate).isFile()) {
          return candidate;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  _startNativeListener() {
    const binaryPath = this._resolveNativeBinary();
    if (!binaryPath) {
      debugLogger.log("[HotkeyCaptureManager] Native capture binary not found, using fallback only");
      return;
    }

    try {
      this.process = spawn(binaryPath, ["--capture"], {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      debugLogger.warn("[HotkeyCaptureManager] Failed to spawn native capture listener", {
        error: error.message,
      });
      return;
    }

    debugLogger.log("[HotkeyCaptureManager] Native capture listener started", { binaryPath });
    this.lineBuffer = "";

    this.process.stdout.setEncoding("utf8");
    this.process.stdout.on("data", (chunk) => {
      this.lineBuffer += chunk;
      const lines = this.lineBuffer.split(/\r?\n/);
      this.lineBuffer = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.trim();
        if (line.startsWith("CAPTURED ")) {
          this._emitHotkey(line.slice("CAPTURED ".length).trim());
        }
      }
    });

    this.process.stderr.setEncoding("utf8");
    this.process.stderr.on("data", (data) => {
      const message = data.toString().trim();
      if (message) {
        debugLogger.debug("[HotkeyCaptureManager] Native stderr", { message });
      }
    });

    const proc = this.process;
    proc.on("exit", (code) => {
      if (this.process === proc) {
        this.process = null;
      }
      if (code !== 0 && code !== null) {
        debugLogger.warn("[HotkeyCaptureManager] Native capture listener exited", { code });
      }
    });
  }

  _stopNativeListener() {
    if (this.process) {
      try {
        this.process.kill();
      } catch {
        // ignore
      }
      this.process = null;
    }
    this.lineBuffer = "";
  }

  _startBeforeInputFallback() {
    if (!this.webContents || this.webContents.isDestroyed()) {
      return;
    }

    this.beforeInputHandler = (event, input) => {
      if (!this.enabled || !this.captureState) {
        return;
      }

      const { hotkey, suppress } = handleNativeCaptureInput(
        this.captureState,
        input,
        process.platform
      );

      if (suppress) {
        event.preventDefault();
      }

      if (hotkey) {
        this._emitHotkey(hotkey);
      }
    };

    this.webContents.on("before-input-event", this.beforeInputHandler);
  }

  _stopBeforeInputFallback() {
    if (this.webContents && !this.webContents.isDestroyed() && this.beforeInputHandler) {
      this.webContents.removeListener("before-input-event", this.beforeInputHandler);
    }
    this.beforeInputHandler = null;
  }
}

module.exports = HotkeyCaptureManager;
