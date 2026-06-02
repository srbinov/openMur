import React, { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { formatHotkeyLabel, isGlobeLikeHotkey } from "../../utils/hotkeys";
import {
  MODIFIER_CODES,
  activeModifierLabels,
  buildModifierOnlyHotkey,
  captureHotkeyFromKeyDown,
  countModifiers,
  modifierCodesFromPressedCodes,
  modifiersFromPressedCodes,
  updatePressedModifierCode,
} from "../../utils/hotkeyCapture";
import { getPlatform } from "../../utils/platform";

export interface HotkeyInputProps {
  value: string;
  onChange: (hotkey: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  validate?: (hotkey: string) => string | null | undefined;
}

export interface HotkeyInputVariant {
  variant?: "default" | "hero";
}

export function HotkeyInput({
  value,
  onChange,
  onBlur,
  disabled = false,
  autoFocus = false,
  variant = "default",
  validate,
}: HotkeyInputProps & HotkeyInputVariant) {
  const { t } = useTranslation();
  const [isCapturing, setIsCapturing] = useState(false);
  const [activeModifiers, setActiveModifiers] = useState<Set<string>>(new Set());
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const [isFnHeld, setIsFnHeld] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastCapturedHotkeyRef = useRef<string | null>(null);
  const lastCaptureTimeRef = useRef(0);
  const keyDownTimeRef = useRef<number>(0);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnHeldRef = useRef(false);
  const fnCapturedKeyRef = useRef(false);
  const isCapturingRef = useRef(false);
  const pressedModifierCodesRef = useRef<Set<string>>(new Set());
  const heldModifiersRef = useRef<{
    ctrl: boolean;
    meta: boolean;
    alt: boolean;
    shift: boolean;
  }>({ ctrl: false, meta: false, alt: false, shift: false });
  const modifierCodesRef = useRef<{
    ctrl?: string;
    meta?: string;
    alt?: string;
    shift?: string;
  }>({});
  const peakModifiersRef = useRef<{
    ctrl: boolean;
    meta: boolean;
    alt: boolean;
    shift: boolean;
  }>({ ctrl: false, meta: false, alt: false, shift: false });
  const peakCodesRef = useRef<{
    ctrl?: string;
    meta?: string;
    alt?: string;
    shift?: string;
  }>({});
  const platform = getPlatform();
  const isMac = platform === "darwin";
  const isWindows = platform === "win32";

  const clearFnHeld = useCallback(() => {
    setIsFnHeld(false);
    fnHeldRef.current = false;
    fnCapturedKeyRef.current = false;
  }, []);

  const resetModifierState = useCallback(() => {
    pressedModifierCodesRef.current = new Set();
    heldModifiersRef.current = { ctrl: false, meta: false, alt: false, shift: false };
    modifierCodesRef.current = {};
    peakModifiersRef.current = { ctrl: false, meta: false, alt: false, shift: false };
    peakCodesRef.current = {};
    setActiveModifiers(fnHeldRef.current ? new Set(["Fn"]) : new Set());
    keyDownTimeRef.current = 0;
  }, []);

  const syncFromPressedCodes = useCallback(() => {
    const held = modifiersFromPressedCodes(pressedModifierCodesRef.current);
    const codes = modifierCodesFromPressedCodes(pressedModifierCodesRef.current);
    heldModifiersRef.current = held;
    modifierCodesRef.current = codes;

    const count = countModifiers(held);
    if (count > countModifiers(peakModifiersRef.current)) {
      peakModifiersRef.current = { ...held };
      peakCodesRef.current = { ...codes };
    }

    const labels = activeModifierLabels(held, platform);
    if (fnHeldRef.current) labels.push("Fn");
    setActiveModifiers(new Set(labels));
  }, [platform]);

  const finalizeCapture = useCallback(
    (hotkey: string) => {
      const now = Date.now();
      if (lastCapturedHotkeyRef.current === hotkey && now - lastCaptureTimeRef.current < 150) {
        return;
      }
      lastCaptureTimeRef.current = now;

      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }

      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }

      if (validate) {
        const errorMsg = validate(hotkey);
        if (errorMsg) {
          setValidationWarning(errorMsg);
          warningTimeoutRef.current = setTimeout(() => setValidationWarning(null), 4000);
          resetModifierState();
          clearFnHeld();
          return;
        }
      }

      setValidationWarning(null);
      lastCapturedHotkeyRef.current = hotkey;
      onChange(hotkey);
      setIsCapturing(false);
      isCapturingRef.current = false;
      setActiveModifiers(new Set());
      clearFnHeld();
      resetModifierState();
      window.electronAPI?.setHotkeyListeningMode?.(false, hotkey);
      containerRef.current?.blur();
    },
    [validate, onChange, clearFnHeld, resetModifierState]
  );

  const tryFinalizeModifierCombo = useCallback(() => {
    const hotkey = buildModifierOnlyHotkey(
      peakModifiersRef.current,
      peakCodesRef.current,
      platform
    );
    if (!hotkey) return false;

    if (fnHeldRef.current) {
      fnCapturedKeyRef.current = true;
      finalizeCapture(`Fn+${hotkey}`);
    } else {
      finalizeCapture(hotkey);
    }
    return true;
  }, [finalizeCapture, platform]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();

      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }

      const code = e.nativeEvent.code;
      if (MODIFIER_CODES.has(code)) {
        updatePressedModifierCode(pressedModifierCodesRef.current, code, true);
        syncFromPressedCodes();
      } else {
        heldModifiersRef.current = {
          ctrl: e.ctrlKey,
          meta: e.metaKey,
          alt: e.altKey,
          shift: e.shiftKey,
        };
      }

      if (keyDownTimeRef.current === 0) {
        keyDownTimeRef.current = Date.now();
      }

      const hotkey = captureHotkeyFromKeyDown(
        {
          ...e.nativeEvent,
          ctrlKey: heldModifiersRef.current.ctrl,
          metaKey: heldModifiersRef.current.meta,
          altKey: heldModifiersRef.current.alt,
          shiftKey: heldModifiersRef.current.shift,
        },
        modifierCodesRef.current,
        platform
      );
      if (hotkey) {
        if (fnHeldRef.current) {
          fnCapturedKeyRef.current = true;
          finalizeCapture(`Fn+${hotkey}`);
        } else {
          finalizeCapture(hotkey);
        }
      }
    },
    [disabled, finalizeCapture, platform, syncFromPressedCodes]
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();

      let attempted = false;

      if (MODIFIER_CODES.has(e.nativeEvent.code)) {
        if (countModifiers(peakModifiersRef.current) >= 2) {
          attempted = tryFinalizeModifierCombo();
        }
        updatePressedModifierCode(pressedModifierCodesRef.current, e.nativeEvent.code, false);
        syncFromPressedCodes();
      }

      if (!attempted && countModifiers(heldModifiersRef.current) === 0) {
        resetModifierState();
      }
    },
    [disabled, tryFinalizeModifierCombo, resetModifierState, syncFromPressedCodes]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || !isCapturing) return;

      const mouseHotkey = e.button === 3 ? "MouseButton4" : e.button === 4 ? "MouseButton5" : null;
      if (!mouseHotkey) return;

      e.preventDefault();
      e.stopPropagation();
      finalizeCapture(mouseHotkey);
    },
    [disabled, isCapturing, finalizeCapture]
  );

  const handleFocus = useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    if (!disabled) {
      setIsCapturing(true);
      isCapturingRef.current = true;
      setValidationWarning(null);
      clearFnHeld();
      resetModifierState();
      window.electronAPI?.setHotkeyListeningMode?.(true);
    }
  }, [disabled, clearFnHeld, resetModifierState]);

  const handleBlur = useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }

    blurTimeoutRef.current = setTimeout(() => {
      setIsCapturing(false);
      isCapturingRef.current = false;
      setActiveModifiers(new Set());
      setValidationWarning(null);
      clearFnHeld();
      resetModifierState();
      window.electronAPI?.setHotkeyListeningMode?.(false, lastCapturedHotkeyRef.current);
      lastCapturedHotkeyRef.current = null;
      onBlur?.();
    }, 350);
  }, [onBlur, clearFnHeld, resetModifierState]);

  useEffect(() => {
    isCapturingRef.current = isCapturing;
  }, [isCapturing]);

  useEffect(() => {
    if (autoFocus && containerRef.current) {
      containerRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      window.electronAPI?.setHotkeyListeningMode?.(false, null);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (isMac) return;

    const disposeNative = window.electronAPI?.onNativeHotkeyCaptured?.((hotkey: string) => {
      if (!isCapturingRef.current || !hotkey) return;
      finalizeCapture(hotkey);
    });

    return () => disposeNative?.();
  }, [isMac, finalizeCapture]);

  useEffect(() => {
    if (!isCapturing || isMac || activeModifiers.size < 2) return;

    const timer = setTimeout(() => {
      if (isCapturingRef.current) {
        tryFinalizeModifierCombo();
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [isCapturing, isMac, activeModifiers, tryFinalizeModifierCombo]);

  useEffect(() => {
    if (!isCapturing || !isMac) return;

    const disposeDown = window.electronAPI?.onGlobeKeyPressed?.(() => {
      setValidationWarning(null);
      setIsFnHeld(true);
      fnHeldRef.current = true;
      fnCapturedKeyRef.current = false;
      setActiveModifiers((prev) => new Set([...prev, "Fn"]));
    });

    const disposeUp = window.electronAPI?.onGlobeKeyReleased?.(() => {
      if (fnHeldRef.current && !fnCapturedKeyRef.current) {
        finalizeCapture("GLOBE");
      }
      setIsFnHeld(false);
      fnHeldRef.current = false;
      fnCapturedKeyRef.current = false;
    });

    return () => {
      disposeDown?.();
      disposeUp?.();
    };
  }, [isCapturing, isMac, finalizeCapture]);

  const displayValue = formatHotkeyLabel(value);
  const isGlobe = isGlobeLikeHotkey(value);
  const hotkeyParts = value?.includes("+") ? displayValue.split("+") : [];
  const hasModifierOnlyCombo = activeModifiers.size >= 2;

  const modifierCaptureHint = hasModifierOnlyCombo
    ? t("hotkeyInput.modifierOnlyHint")
    : isFnHeld
      ? t("hotkeyInput.fnHeldHint")
      : null;

  // Hero variant: large centered key display for onboarding
  if (variant === "hero") {
    return (
      <div
        ref={containerRef}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-label={t("hotkeyInput.ariaLabel")}
        data-capturing={isCapturing || undefined}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onMouseDown={handleMouseDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={`
          relative group flex flex-col items-center justify-center py-4 px-5 min-h-28
          rounded-md border cursor-pointer select-none outline-none
          transition-colors duration-150
          ${
            disabled
              ? "bg-muted/30 border-border cursor-not-allowed opacity-50"
              : isCapturing
                ? "bg-primary/5 border-primary/30 shadow-[0_0_0_2px_rgba(37,99,212,0.1)]"
                : "bg-surface-1 border-border hover:border-border-hover hover:bg-surface-2"
          }
        `}
      >
        {isCapturing ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <span className="text-xs font-medium text-primary">{t("hotkeyInput.listening")}</span>
            </div>
            {activeModifiers.size > 0 ? (
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-1.5">
                  {Array.from(activeModifiers).map((mod) => (
                    <kbd
                      key={mod}
                      className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-sm text-xs font-semibold text-primary"
                    >
                      {mod}
                    </kbd>
                  ))}
                  {!hasModifierOnlyCombo && (
                    <span className="text-primary/50 text-sm font-medium">+</span>
                  )}
                </div>
                {modifierCaptureHint && (
                  <span className="text-xs text-muted-foreground">{modifierCaptureHint}</span>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">
                {isMac ? t("hotkeyInput.pressAnyKeyMac") : t("hotkeyInput.pressAnyKey")}
              </span>
            )}
            {validationWarning && (
              <div className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-md bg-warning/8 border border-warning/20 dark:bg-warning/12 dark:border-warning/25">
                <AlertTriangle className="w-3 h-3 text-warning shrink-0" />
                <span className="text-xs text-warning dark:text-amber-400">
                  {validationWarning}
                </span>
              </div>
            )}
          </div>
        ) : value ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-1.5">
              {hotkeyParts.length > 0 ? (
                hotkeyParts.map((part, i) => (
                  <React.Fragment key={part}>
                    {i > 0 && (
                      <span className="text-muted-foreground/40 text-lg font-light">+</span>
                    )}
                    <kbd className="px-3 py-1.5 bg-surface-raised border border-border rounded-sm text-sm font-semibold text-foreground shadow-sm">
                      {part}
                    </kbd>
                  </React.Fragment>
                ))
              ) : isGlobe ? (
                <kbd className="px-3 py-1.5 bg-surface-raised border border-border rounded-sm text-lg shadow-sm">
                  🌐
                </kbd>
              ) : (
                <kbd className="px-3 py-1.5 bg-surface-raised border border-border rounded-sm text-sm font-semibold text-foreground shadow-sm">
                  {displayValue}
                </kbd>
              )}
            </div>
            <span className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
              {t("hotkeyInput.clickToChange")}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
            <span className="text-sm font-medium">{t("hotkeyInput.clickToSet")}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={disabled ? -1 : 0}
      role="button"
      aria-label={t("hotkeyInput.ariaLabel")}
      data-capturing={isCapturing || undefined}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onMouseDown={handleMouseDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={`
        relative overflow-hidden rounded-md border
        transition-colors duration-150 cursor-pointer select-none focus:outline-none
        ${
          disabled
            ? "bg-muted/30 border-border cursor-not-allowed opacity-50"
            : isCapturing
              ? "bg-primary/5 border-primary/30 shadow-[0_0_0_2px_rgba(37,99,212,0.1)]"
              : "bg-surface-1 border-border hover:border-border-hover hover:bg-surface-2"
        }
      `}
    >
      {isCapturing && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary animate-pulse" />
      )}

      <div className="px-4 py-3">
        {isCapturing ? (
          <>
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                <span className="text-xs font-medium text-muted-foreground">
                  {t("hotkeyInput.recording")}
                </span>
              </div>
              {activeModifiers.size > 0 ? (
                <div className="flex items-center gap-1">
                  {Array.from(activeModifiers).map((mod) => (
                    <kbd
                      key={mod}
                      className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-sm text-xs font-semibold text-primary"
                    >
                      {mod}
                    </kbd>
                  ))}
                  {!hasModifierOnlyCombo && (
                    <span className="text-primary/40 text-xs">
                      {isFnHeld ? t("hotkeyInput.fnCaptureHint") : t("hotkeyInput.keyHint")}
                    </span>
                  )}
                  {hasModifierOnlyCombo && (
                    <span className="text-primary/40 text-xs">{t("hotkeyInput.modifierOnlyHint")}</span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {isMac ? t("hotkeyInput.tryShortcutMac") : t("hotkeyInput.tryShortcut")}
                </span>
              )}
            </div>
            {validationWarning && (
              <div className="flex items-center gap-1.5 mt-1.5 px-3 py-1.5 rounded-md bg-warning/8 border border-warning/20 dark:bg-warning/12 dark:border-warning/25">
                <AlertTriangle className="w-3 h-3 text-warning shrink-0" />
                <span className="text-xs text-warning dark:text-amber-400">
                  {validationWarning}
                </span>
              </div>
            )}
          </>
        ) : value ? (
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("hotkeyInput.hotkeyLabel")}
            </span>
            <div className="flex items-center gap-2">
              {hotkeyParts.length > 0 ? (
                <div className="flex items-center gap-1">
                  {hotkeyParts.map((part, i) => (
                    <React.Fragment key={part}>
                      {i > 0 && <span className="text-muted-foreground/30 text-xs">+</span>}
                      <kbd className="px-2 py-0.5 bg-surface-raised border border-border rounded-sm text-xs font-semibold text-foreground">
                        {part}
                      </kbd>
                    </React.Fragment>
                  ))}
                </div>
              ) : isGlobe ? (
                <div className="flex items-center gap-1.5">
                  <kbd className="px-2 py-0.5 bg-surface-raised border border-border rounded-sm text-base">
                    🌐
                  </kbd>
                  <span className="text-xs text-muted-foreground">{t("hotkeyInput.globe")}</span>
                </div>
              ) : (
                <kbd className="px-2.5 py-1 bg-surface-raised border border-border rounded-sm text-xs font-semibold text-foreground">
                  {displayValue}
                </kbd>
              )}
              <span className="text-xs text-muted-foreground/50">
                {t("hotkeyInput.clickToChangeLower")}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <span className="text-sm font-medium">{t("hotkeyInput.clickToSet")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default HotkeyInput;
