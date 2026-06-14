import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Settings,
  Command,
  UserCircle,
} from "lucide-react";
import TitleBar from "./TitleBar";
import WindowControls from "./WindowControls";
import PermissionsSection from "./ui/PermissionsSection";
import StepProgress from "./ui/StepProgress";
import { AlertDialog, ConfirmDialog } from "./ui/dialog";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useDialogs } from "../hooks/useDialogs";
import { usePermissions } from "../hooks/usePermissions";
import { useClipboard } from "../hooks/useClipboard";
import { useSystemAudioPermission } from "../hooks/useSystemAudioPermission";
import { useSettings } from "../hooks/useSettings";
import LanguageSelector from "./ui/LanguageSelector";
import ApiKeyInput from "./ui/ApiKeyInput";
import { applyLocalOnlySettings } from "../config/localOnlyMode";
import { GlassWindow } from "./ui/liquid-glass";
import { useSettingsStore } from "../stores/settingsStore";
import { formatHotkeyLabel, getDefaultHotkey, isGlobeLikeHotkey } from "../utils/hotkeys";
import { HotkeyInput } from "./ui/HotkeyInput";
import { useHotkeyRegistration } from "../hooks/useHotkeyRegistration";
import { getValidationMessage } from "../utils/hotkeyValidator";
import { getCachedPlatform, getPlatform } from "../utils/platform";
import logger from "../utils/logger";
import { ActivationModeSelector } from "./ui/ActivationModeSelector";
import { ACCESSIBILITY_SKIPPED_KEY, areRequiredPermissionsMet } from "../utils/permissions";

interface OnboardingFlowProps {
  onComplete: () => void;
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { t } = useTranslation();

  const getMaxStep = () => 2;

  const [currentStep, setCurrentStep, removeCurrentStep] = useLocalStorage(
    "onboardingCurrentStep",
    0,
    {
      serialize: String,
      deserialize: (value) => {
        const parsed = parseInt(value, 10);
        // Clamp to valid range to handle users upgrading from older versions
        // with different step counts
        if (isNaN(parsed) || parsed < 0) return 0;
        const maxStep = getMaxStep();
        if (parsed > maxStep) return maxStep;
        return parsed;
      },
    }
  );
  const [accessibilitySkipped, setAccessibilitySkipped] = useLocalStorage(
    ACCESSIBILITY_SKIPPED_KEY,
    false,
    {
      serialize: String,
      deserialize: (value) => value === "true",
    }
  );

  const {
    useLocalWhisper,
    whisperModel,
    localTranscriptionProvider,
    parakeetModel,
    dictationKey,
    activationMode,
    setActivationMode,
    setDictationKey,
    setUseLocalWhisper,
    updateTranscriptionSettings,
    preferredLanguage,
    anthropicApiKey,
    setAnthropicApiKey,
  } = useSettings();

  const [hotkey, setHotkey] = useState(dictationKey || getDefaultHotkey());
  const [isModelDownloaded, setIsModelDownloaded] = useState(false);
  const [isUsingNativeShortcut, setIsUsingNativeShortcut] = useState(false);
  const readableHotkey = formatHotkeyLabel(hotkey);
  const { alertDialog, confirmDialog, showAlertDialog, hideAlertDialog, hideConfirmDialog } =
    useDialogs();

  const autoRegisterInFlightRef = useRef(false);
  const hotkeyStepInitializedRef = useRef(false);

  const { registerHotkey, isRegistering: isHotkeyRegistering } = useHotkeyRegistration({
    onSuccess: (registeredHotkey) => {
      setHotkey(registeredHotkey);
      setDictationKey(registeredHotkey);
    },
    showSuccessToast: false,
    showErrorToast: true,
    showAlert: showAlertDialog,
  });

  const validateHotkeyForInput = useCallback(
    (hotkey: string) => getValidationMessage(hotkey, getPlatform()),
    []
  );

  const permissionsHook = usePermissions(showAlertDialog);
  useClipboard(showAlertDialog); // Initialize clipboard hook for permission checks

  const systemAudio = useSystemAudioPermission();

  useEffect(() => {
    if (permissionsHook.accessibilityPermissionGranted && accessibilitySkipped) {
      setAccessibilitySkipped(false);
    }
  }, [
    permissionsHook.accessibilityPermissionGranted,
    accessibilitySkipped,
    setAccessibilitySkipped,
  ]);

  const steps = useMemo(
    () => [
      { id: "welcome", title: t("onboarding.steps.welcome"), icon: UserCircle },
      { id: "setup", title: t("onboarding.steps.setup"), icon: Settings },
      { id: "activation", title: t("onboarding.steps.activation"), icon: Command },
    ],
    [t]
  );

  // Only show progress for signed-up users after account creation step
  const showProgress = currentStep > 0;

  useEffect(() => {
    applyLocalOnlySettings((partial) => useSettingsStore.setState(partial));
    setUseLocalWhisper(true);
    setActivationMode("push");
  }, [setUseLocalWhisper, setActivationMode]);

  useEffect(() => {
    const checkHotkeyMode = async () => {
      try {
        const info = await window.electronAPI?.getHotkeyModeInfo();
        if (info?.isUsingNativeShortcut) {
          setIsUsingNativeShortcut(true);
        }
      } catch (error) {
        logger.error("Failed to check hotkey mode", { error }, "onboarding");
      }
    };
    checkHotkeyMode();
  }, []);

  // Update wizard UI when backend falls back to a different hotkey.
  // Only update local state — don't persist to localStorage so the app
  // retries the preferred key on next launch.
  useEffect(() => {
    const unsubscribe = window.electronAPI?.onHotkeyFallbackUsed?.((data: { fallback: string }) => {
      if (data?.fallback) {
        setHotkey(data.fallback);
      }
    });
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    const modelToCheck = localTranscriptionProvider === "nvidia" ? parakeetModel : whisperModel;
    if (!useLocalWhisper || !modelToCheck) {
      setIsModelDownloaded(false);
      return;
    }

    const checkStatus = async () => {
      try {
        const result =
          localTranscriptionProvider === "nvidia"
            ? await window.electronAPI?.checkParakeetModelStatus(modelToCheck)
            : await window.electronAPI?.checkModelStatus(modelToCheck);
        setIsModelDownloaded(result?.downloaded ?? false);
      } catch (error) {
        logger.error("Failed to check model status", { error }, "onboarding");
        setIsModelDownloaded(false);
      }
    };

    checkStatus();
  }, [useLocalWhisper, whisperModel, parakeetModel, localTranscriptionProvider]);

  const activationStepIndex = 2;

  useEffect(() => {
    if (currentStep !== activationStepIndex) {
      // Reset initialization flag when leaving activation step
      hotkeyStepInitializedRef.current = false;
      return;
    }

    // Prevent double-invocation from React.StrictMode
    if (autoRegisterInFlightRef.current || hotkeyStepInitializedRef.current) {
      return;
    }

    const autoRegisterDefaultHotkey = async () => {
      autoRegisterInFlightRef.current = true;
      hotkeyStepInitializedRef.current = true;

      try {
        // Windows/Linux: always use the platform default — Ctrl+Win capture is unreliable
        // because the OS swallows the Windows/Super key before the UI can read both modifiers.
        const platform = window.electronAPI?.getPlatform?.() ?? "darwin";
        if (platform !== "darwin") {
          const defaultHotkey =
            platform === "win32"
              ? "Control+Super"
              : (await window.electronAPI?.getEffectiveDefaultHotkey?.()) || getDefaultHotkey();

          const success = await registerHotkey(defaultHotkey);
          if (success) {
            setHotkey(defaultHotkey);
            setDictationKey(defaultHotkey);
          }
          return;
        }

        // macOS: auto-register Globe if nothing set yet
        const defaultHotkey =
          (await window.electronAPI?.getEffectiveDefaultHotkey?.()) || getDefaultHotkey();

        const shouldAutoRegister =
          !hotkey || hotkey.trim() === "" || isGlobeLikeHotkey(hotkey);

        if (shouldAutoRegister) {
          const success = await registerHotkey(defaultHotkey);
          if (success) {
            setHotkey(defaultHotkey);
          }
        }
      } catch (error) {
        logger.error("Failed to auto-register default hotkey", { error }, "onboarding");
      } finally {
        autoRegisterInFlightRef.current = false;
      }
    };

    void autoRegisterDefaultHotkey();
  }, [currentStep, hotkey, registerHotkey, activationStepIndex, setDictationKey]);

  const ensureHotkeyRegistered = useCallback(async () => {
    if (!window.electronAPI?.updateHotkey) {
      return true;
    }

    try {
      const result = await window.electronAPI.updateHotkey(hotkey);
      if (result && !result.success) {
        showAlertDialog({
          title: t("onboarding.hotkey.couldNotRegisterTitle"),
          description: result.message || t("onboarding.hotkey.couldNotRegisterDescription"),
        });
        return false;
      }
      return true;
    } catch (error) {
      logger.error("Failed to register onboarding hotkey", { error }, "onboarding");
      showAlertDialog({
        title: t("onboarding.hotkey.couldNotRegisterTitle"),
        description: t("onboarding.hotkey.couldNotRegisterDescription"),
      });
      return false;
    }
  }, [hotkey, showAlertDialog, t]);

  const saveSettings = useCallback(async () => {
    const hotkeyRegistered = await ensureHotkeyRegistered();
    if (!hotkeyRegistered) {
      return false;
    }
    setDictationKey(hotkey);

    localStorage.setItem("onboardingCompleted", "true");

    // Fresh install: write the bundle-migration sentinel so the
    // PostMigrationOnboarding modal doesn't fire on next launch.
    void window.electronAPI?.markBundleMigrated?.();

    try {
      await window.electronAPI?.saveAllKeysToEnv?.();
    } catch (error) {
      logger.error("Failed to persist API keys", { error }, "onboarding");
    }

    return true;
  }, [hotkey, setDictationKey, ensureHotkeyRegistered]);

  const nextStep = useCallback(async () => {
    if (currentStep >= steps.length - 1) {
      return;
    }

    const currentStepId = steps[currentStep]?.id;
    if (
      getPlatform() === "darwin" &&
      currentStepId === "setup" &&
      !permissionsHook.accessibilityPermissionGranted
    ) {
      setAccessibilitySkipped(true);
    }

    const newStep = currentStep + 1;
    setCurrentStep(newStep);

    // Show dictation panel when entering activation step
    if (newStep === activationStepIndex) {
      if (window.electronAPI?.showDictationPanel) {
        window.electronAPI.showDictationPanel();
      }
    }
  }, [
    currentStep,
    setCurrentStep,
    steps,
    activationStepIndex,
    permissionsHook.accessibilityPermissionGranted,
    setAccessibilitySkipped,
  ]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
    }
  }, [currentStep, setCurrentStep]);

  const finishOnboarding = useCallback(async () => {
    const saved = await saveSettings();
    if (!saved) {
      return;
    }
    removeCurrentStep();
    onComplete();
  }, [saveSettings, removeCurrentStep, onComplete]);

  const renderStep = () => {
    switch (currentStep) {
      case 0: // Welcome
        return (
          <div className="text-center space-y-5">
            <div className="w-16 h-16 mx-auto">
              <svg viewBox="0 0 1024 1024" className="w-full h-full drop-shadow-sm" aria-hidden>
                <rect width="1024" height="1024" rx="241" fill="#2056DF" />
                <circle cx="512" cy="512" r="314" fill="#2056DF" stroke="white" strokeWidth="74" />
                <path d="M512 383V641" stroke="white" strokeWidth="74" strokeLinecap="round" />
                <path d="M627 457V568" stroke="white" strokeWidth="74" strokeLinecap="round" />
                <path d="M397 457V568" stroke="white" strokeWidth="74" strokeLinecap="round" />
              </svg>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">
                {t("onboarding.welcome.title")}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("onboarding.welcome.description")}
              </p>
            </div>
            <Button onClick={nextStep} className="w-full rounded-full">
              {t("onboarding.welcome.getStarted")}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        );

      case 1: // Setup - merged with permissions
        return (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-7 h-7 text-green-500" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground mb-2">
                  {t("onboarding.setup.title")}
                </h2>
                <p className="text-muted-foreground">{t("onboarding.setup.description")}</p>
                <p className="text-sm text-muted-foreground/80 mt-2">
                  {t("onboarding.setup.localFlowDescription")}
                </p>
              </div>

              {/* Anthropic API key for text cleanup */}
              <div className="space-y-2.5 p-3 bg-muted/50 border border-border/60 rounded">
                <ApiKeyInput
                  apiKey={anthropicApiKey}
                  setApiKey={setAnthropicApiKey}
                  label={t("onboarding.setup.anthropicKeyLabel")}
                  helpText={t("onboarding.setup.anthropicKeyHelp")}
                  className="w-full"
                />
              </div>

              {/* Language Selector */}
              <div className="space-y-2.5 p-3 bg-muted/50 border border-border/60 rounded">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">
                    {t("onboarding.setup.language")}
                  </label>
                  <LanguageSelector
                    value={preferredLanguage}
                    onChange={(value) => {
                      updateTranscriptionSettings({ preferredLanguage: value });
                    }}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Permissions */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">
                  {t("onboarding.permissions.title")}
                </h3>
                <PermissionsSection permissions={permissionsHook} systemAudio={systemAudio} />
              </div>
            </div>
          );

      case 2: // Activation
        return renderActivationStep();

      default:
        return null;
    }
  };

  const activationPlatform = getCachedPlatform();
  const usesPresetHotkey = activationPlatform !== "darwin";

  const renderActivationStep = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center space-y-0.5">
        <h2 className="text-lg font-semibold text-foreground tracking-tight">
          {t("onboarding.activation.title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("onboarding.activation.description")}</p>
      </div>

      {/* Unified control surface */}
      <div className="rounded-lg border border-border-subtle bg-surface-1 overflow-hidden">
        {/* Hotkey section */}
        <div className="p-4 border-b border-border-subtle">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("onboarding.activation.hotkey")}
            </span>
          </div>
          {usesPresetHotkey ? (
            <div className="flex flex-col items-center justify-center py-4 px-5 min-h-28 rounded-md border border-border bg-surface-1">
              <div className="flex items-center gap-1.5">
                {readableHotkey.split("+").map((part, i) => (
                  <React.Fragment key={`${part}-${i}`}>
                    {i > 0 && (
                      <span className="text-muted-foreground/40 text-lg font-light">+</span>
                    )}
                    <kbd className="px-3 py-1.5 bg-surface-raised border border-border rounded-sm text-sm font-semibold text-foreground shadow-sm">
                      {part}
                    </kbd>
                  </React.Fragment>
                ))}
              </div>
              <span className="text-xs text-muted-foreground mt-2 text-center">
                {t("onboarding.activation.presetHotkeyNote")}
              </span>
            </div>
          ) : (
            <HotkeyInput
              value={hotkey}
              onChange={async (newHotkey) => {
                const success = await registerHotkey(newHotkey);
                if (success) {
                  setHotkey(newHotkey);
                }
              }}
              disabled={isHotkeyRegistering}
              variant="hero"
              validate={validateHotkeyForInput}
            />
          )}
        </div>

        {/* Mode section - inline with hotkey */}
        {(!isUsingNativeShortcut || getCachedPlatform() === "linux") && (
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("onboarding.activation.mode")}
              </span>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                {activationMode === "tap"
                  ? t("onboarding.activation.tapDescription")
                  : t("onboarding.activation.holdDescription")}
              </p>
            </div>
            <ActivationModeSelector
              value={activationMode}
              onChange={setActivationMode}
              variant="compact"
            />
          </div>
        )}
      </div>

      {/* Test area - minimal chrome */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t("onboarding.activation.test")}
          </span>
          <span className="text-xs text-muted-foreground/60">
            {activationMode === "tap" || (isUsingNativeShortcut && getCachedPlatform() !== "linux")
              ? t("onboarding.activation.hotkeyToStartStop", { hotkey: readableHotkey })
              : t("onboarding.activation.holdHotkey", { hotkey: readableHotkey })}
          </span>
        </div>
        <Textarea
          rows={2}
          placeholder={t("onboarding.activation.textareaPlaceholder")}
          className="text-sm resize-none"
        />
      </div>
    </div>
  );

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return true;
      case 1:
        return areRequiredPermissionsMet(permissionsHook.micPermissionGranted);
      case 2:
        return hotkey.trim() !== "";
      default:
        return false;
    }
  };

  // Load Google Font only in the browser
  React.useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@300;400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const onboardingPlatform =
    typeof window !== "undefined" && window.electronAPI?.getPlatform
      ? window.electronAPI.getPlatform()
      : "darwin";

  return (
    <GlassWindow
      className="control-panel-window h-screen flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => !open && hideConfirmDialog()}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        onConfirm={confirmDialog.onConfirm}
      />

      <AlertDialog
        open={alertDialog.open}
        onOpenChange={(open) => !open && hideAlertDialog()}
        title={alertDialog.title}
        description={alertDialog.description}
        onOk={() => {}}
      />

      {/* Title Bar / drag region */}
      {currentStep === 0 ? (
        <div
          className="relative w-full h-11 shrink-0"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          {onboardingPlatform !== "darwin" && (
            <div
              className="absolute top-2.5 right-3 z-20"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              <WindowControls />
            </div>
          )}
        </div>
      ) : (
        <div className="shrink-0 z-10">
          <TitleBar showTitle={true} />
        </div>
      )}

      {/* Progress Bar - hidden on welcome/auth step */}
      {showProgress && (
        <div className="shrink-0 bg-white/5 dark:bg-white/3 backdrop-blur-xl border-b border-white/10 px-6 md:px-12 py-3 z-10">
          <div className="max-w-3xl mx-auto">
            <StepProgress steps={steps.slice(1)} currentStep={currentStep - 1} />
          </div>
        </div>
      )}

      {/* Content - This will grow to fill available space */}
      <div
        className={`flex-1 px-6 md:px-12 overflow-y-auto ${currentStep === 0 ? "flex items-center" : "py-6"}`}
      >
        <div className={`w-full ${currentStep === 0 ? "max-w-sm" : "max-w-3xl"} mx-auto`}>
          <Card className="border border-white/15 dark:border-white/10 shadow-lg rounded-xl overflow-hidden">
            <CardContent className={currentStep === 0 ? "p-6" : "p-6 md:p-8"}>
              {renderStep()}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer Navigation - hidden on welcome/auth step */}
      {showProgress && (
        <div className="shrink-0 bg-white/5 dark:bg-white/3 backdrop-blur-xl border-t border-white/10 px-6 md:px-12 py-3 z-10">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <Button
              onClick={prevStep}
              variant="outline"
              disabled={currentStep === 0}
              className="h-8 px-5 rounded-full text-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              {t("common.back")}
            </Button>

            <div className="flex items-center gap-2">
              {currentStep === steps.length - 1 ? (
                <Button
                  onClick={finishOnboarding}
                  disabled={!canProceed()}
                  variant="success"
                  className="h-8 px-6 rounded-full text-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  {t("common.complete")}
                </Button>
              ) : (
                <Button
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="h-8 px-6 rounded-full text-xs"
                >
                  {t("common.next")}
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </GlassWindow>
  );
}
