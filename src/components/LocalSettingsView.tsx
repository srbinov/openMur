import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic } from "lucide-react";
import { SettingsLayoutProvider } from "./ui/useSettingsLayout";
import {
  SettingsPanel,
  SettingsPanelRow,
  SettingsRow,
  SectionHeader,
} from "./ui/SettingsSection";
import LanguageSelector from "./ui/LanguageSelector";
import MicrophoneSettings from "./ui/MicrophoneSettings";
import { HotkeyInput } from "./ui/HotkeyInput";
import { ActivationModeSelector } from "./ui/ActivationModeSelector";
import LinuxPttSetupInfo from "./ui/LinuxPttSetupInfo";
import { Toggle } from "./ui/toggle";
import TranscriptionModelPicker from "./TranscriptionModelPicker";
import LocalCleanupConfigEditor from "./settings/LocalCleanupConfigEditor";
import { useSettings } from "../hooks/useSettings";
import { useHotkeyRegistration } from "../hooks/useHotkeyRegistration";
import { useDialogs } from "../hooks/useDialogs";
import { validateHotkeyForSlot } from "../utils/hotkeyValidation";
import { useTheme } from "../hooks/useTheme";
import { formatHotkeyLabel } from "../utils/hotkeys";
import { getCachedPlatform } from "../utils/platform";
import type { LocalTranscriptionProvider } from "../types/electron";
import { TRANSCRIPTION_RETENTION_MINUTES } from "../config/localOnlyMode";
import { cn } from "./lib/utils";
import logger from "../utils/logger";

export type LocalSettingsTab = "general" | "models" | "hotkeys";

const UI_LANGUAGE_OPTIONS: import("./ui/LanguageSelector").LanguageOption[] = [
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "es", label: "Español", flag: "🇪🇸" },
  { value: "fr", label: "Français", flag: "🇫🇷" },
  { value: "de", label: "Deutsch", flag: "🇩🇪" },
  { value: "pt", label: "Português", flag: "🇵🇹" },
  { value: "it", label: "Italiano", flag: "🇮🇹" },
  { value: "ru", label: "Русский", flag: "🇷🇺" },
  { value: "ja", label: "日本語", flag: "🇯🇵" },
  { value: "zh-CN", label: "简体中文", flag: "🇨🇳" },
  { value: "zh-TW", label: "繁體中文", flag: "🇹🇼" },
];

interface LocalSettingsViewProps {
  activeTab: LocalSettingsTab;
}

export default function LocalSettingsView({ activeTab }: LocalSettingsViewProps) {
  const { t } = useTranslation();
  const { showAlertDialog } = useDialogs();
  const { theme, setTheme } = useTheme();
  const platform = getCachedPlatform();

  const {
    uiLanguage,
    setUiLanguage,
    preferredLanguage,
    updateTranscriptionSettings,
    whisperModel,
    setWhisperModel,
    localTranscriptionProvider,
    setLocalTranscriptionProvider,
    parakeetModel,
    setParakeetModel,
    useLocalWhisper,
    setUseLocalWhisper,
    cloudTranscriptionProvider,
    setCloudTranscriptionProvider,
    cloudTranscriptionModel,
    setCloudTranscriptionModel,
    useCleanupModel,
    updateCleanupSettings,
    dictationKey,
    setDictationKey,
    activationMode,
    setActivationMode,
    autoPasteEnabled,
    setAutoPasteEnabled,
    audioCuesEnabled,
    setAudioCuesEnabled,
    showTranscriptionPreview,
    setShowTranscriptionPreview,
    dataRetentionEnabled,
    preferBuiltInMic,
    selectedMicDeviceId,
    setPreferBuiltInMic,
    setSelectedMicDeviceId,
  } = useSettings();

  const { registerHotkey, isRegistering: isHotkeyRegistering } = useHotkeyRegistration({
    onSuccess: (registeredHotkey) => setDictationKey(registeredHotkey),
    showSuccessToast: false,
    showErrorToast: true,
    showAlert: showAlertDialog,
  });

  const validateDictationHotkey = useCallback(
    (hotkey: string) => validateHotkeyForSlot(hotkey, {}, t),
    [t]
  );

  const [isUsingNativeShortcut, setIsUsingNativeShortcut] = useState(false);
  const [linuxPttAvailable, setLinuxPttAvailable] = useState(true);
  const [effectiveDefaultHotkey, setEffectiveDefaultHotkey] = useState<string | null>(null);

  useEffect(() => {
    const checkHotkeyMode = async () => {
      try {
        const info = await window.electronAPI?.getHotkeyModeInfo?.();
        if (info?.isUsingNativeShortcut) {
          setIsUsingNativeShortcut(true);
          if (!info.supportsPushToTalk) {
            setActivationMode("tap");
          }
        }
      } catch (error) {
        logger.error("Failed to check hotkey mode", error, "settings");
      }
      try {
        const key = await window.electronAPI?.getEffectiveDefaultHotkey?.();
        if (key) setEffectiveDefaultHotkey(key);
      } catch (error) {
        logger.error("Failed to get effective default hotkey", error, "settings");
      }
    };
    checkHotkeyMode();
  }, [setActivationMode]);

  const handleLocalModelSelect = useCallback(
    (modelId: string) => {
      if (localTranscriptionProvider === "nvidia") {
        setParakeetModel(modelId);
      } else {
        setWhisperModel(modelId);
      }
    },
    [localTranscriptionProvider, setParakeetModel, setWhisperModel]
  );

  const renderGeneral = () => (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-sm font-semibold text-foreground tracking-tight">
          {t("localSetup.general.title")}
        </h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {t("localSetup.general.description")}
        </p>
      </div>

      <div>
        <SectionHeader
          title={t("settings.language.sectionTitle")}
          description={t("settings.language.sectionDescription")}
        />
        <SettingsPanel>
          <SettingsPanelRow>
            <SettingsRow
              label={t("settings.language.uiLabel")}
              description={t("settings.language.uiDescription")}
            >
              <LanguageSelector
                value={uiLanguage}
                onChange={setUiLanguage}
                options={UI_LANGUAGE_OPTIONS}
                className="min-w-32"
              />
            </SettingsRow>
          </SettingsPanelRow>
          <SettingsPanelRow>
            <SettingsRow
              label={t("settings.language.transcriptionLabel")}
              description={t("settings.language.transcriptionDescription")}
            >
              <LanguageSelector
                value={preferredLanguage}
                onChange={(value) => updateTranscriptionSettings({ preferredLanguage: value })}
              />
            </SettingsRow>
          </SettingsPanelRow>
        </SettingsPanel>
      </div>

      <div>
        <SectionHeader title={t("settingsPage.general.appearance.title")} />
        <SettingsPanel>
          <SettingsPanelRow>
            <SettingsRow label={t("settingsPage.general.appearance.theme")}>
              <div className="inline-flex items-center gap-px p-0.5 bg-muted/60 dark:bg-surface-2 rounded-md">
                {(["light", "dark", "auto"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTheme(option)}
                    className={cn(
                      "px-2.5 py-1 rounded-[5px] text-xs font-medium capitalize transition-colors",
                      theme === option
                        ? "bg-background dark:bg-surface-raised text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t(`settingsPage.general.appearance.${option}`)}
                  </button>
                ))}
              </div>
            </SettingsRow>
          </SettingsPanelRow>
        </SettingsPanel>
      </div>

      <div>
        <SectionHeader
          title={t("settingsPage.general.microphone.title")}
          description={t("settingsPage.general.microphone.description")}
        />
        <MicrophoneSettings
          preferBuiltInMic={preferBuiltInMic}
          selectedMicDeviceId={selectedMicDeviceId}
          onPreferBuiltInChange={setPreferBuiltInMic}
          onDeviceSelect={setSelectedMicDeviceId}
        />
      </div>

      <div>
        <SectionHeader title={t("settingsPage.general.clipboard.title")} />
        <SettingsPanel>
          <SettingsPanelRow>
            <SettingsRow
              label={t("settingsPage.general.clipboard.autoPaste")}
              description={t("settingsPage.general.clipboard.autoPasteDescription")}
            >
              <Toggle checked={autoPasteEnabled} onChange={setAutoPasteEnabled} />
            </SettingsRow>
          </SettingsPanelRow>
          <SettingsPanelRow>
            <SettingsRow
              label={t("settingsPage.general.soundEffects.dictationSounds")}
              description={t("settingsPage.general.soundEffects.dictationSoundsDescription")}
            >
              <Toggle checked={audioCuesEnabled} onChange={setAudioCuesEnabled} />
            </SettingsRow>
          </SettingsPanelRow>
          <SettingsPanelRow>
            <SettingsRow
              label={t("settingsPage.transcription.transcriptionPreview")}
              description={t("settingsPage.transcription.transcriptionPreviewDescription")}
            >
              <Toggle checked={showTranscriptionPreview} onChange={setShowTranscriptionPreview} />
            </SettingsRow>
          </SettingsPanelRow>
        </SettingsPanel>
      </div>

      {dataRetentionEnabled && (
        <p className="text-[11px] text-muted-foreground/70 leading-relaxed rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
          {t("localSetup.general.retentionHint", { minutes: TRANSCRIPTION_RETENTION_MINUTES })}
        </p>
      )}
    </div>
  );

  const renderModels = () => (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-sm font-semibold text-foreground tracking-tight">
          {t("localSetup.models.title")}
        </h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {t("localSetup.models.description")}
        </p>
      </div>

      <div>
        <SectionHeader
          title={t("localSetup.models.whisperTitle")}
          description={t("localSetup.models.whisperDescription")}
        />
        <div className="rounded-lg border border-border/50 dark:border-border-subtle/70 bg-card/40 p-3">
          <TranscriptionModelPicker
            selectedCloudProvider={cloudTranscriptionProvider}
            onCloudProviderSelect={setCloudTranscriptionProvider}
            selectedCloudModel={cloudTranscriptionModel}
            onCloudModelSelect={setCloudTranscriptionModel}
            selectedLocalModel={
              localTranscriptionProvider === "nvidia" ? parakeetModel : whisperModel
            }
            onLocalModelSelect={handleLocalModelSelect}
            selectedLocalProvider={localTranscriptionProvider}
            onLocalProviderSelect={(p) =>
              setLocalTranscriptionProvider(p as LocalTranscriptionProvider)
            }
            useLocalWhisper={useLocalWhisper}
            onModeChange={(isLocal) => {
              setUseLocalWhisper(isLocal);
              updateTranscriptionSettings({ useLocalWhisper: isLocal });
            }}
            mode="local"
            variant="settings"
          />
        </div>
      </div>

      <div>
        <SectionHeader
          title={t("localSetup.models.cleanupTitle")}
          description={t("localSetup.models.cleanupDescription")}
        />
        <SettingsPanel>
          <SettingsPanelRow>
            <SettingsRow
              label={t("settingsPage.aiModels.enableTextCleanup")}
              description={t("settingsPage.aiModels.enableTextCleanupDescription")}
            >
              <Toggle
                checked={useCleanupModel}
                onChange={(value) => updateCleanupSettings({ useCleanupModel: value })}
              />
            </SettingsRow>
          </SettingsPanelRow>
        </SettingsPanel>

        {useCleanupModel && (
          <div className="mt-4">
            <LocalCleanupConfigEditor />
          </div>
        )}
      </div>
    </div>
  );

  const renderHotkeys = () => (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-sm font-semibold text-foreground tracking-tight">
          {t("localSetup.hotkeys.title")}
        </h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {t("localSetup.hotkeys.description")}
        </p>
      </div>

      <div>
        <SectionHeader
          title={t("settingsPage.general.hotkey.title")}
          description={t("settingsPage.general.hotkey.description")}
        />
        <SettingsPanel>
          <SettingsPanelRow>
            <HotkeyInput
              value={dictationKey}
              onChange={async (newHotkey) => {
                await registerHotkey(newHotkey);
              }}
              disabled={isHotkeyRegistering}
              validate={validateDictationHotkey}
            />
            {effectiveDefaultHotkey && dictationKey && dictationKey !== effectiveDefaultHotkey && (
              <button
                type="button"
                onClick={() => registerHotkey(effectiveDefaultHotkey)}
                disabled={isHotkeyRegistering}
                className="mt-2 text-xs text-muted-foreground/70 hover:text-foreground transition-colors disabled:opacity-50"
              >
                {t("settingsPage.general.hotkey.resetToDefault", {
                  hotkey: formatHotkeyLabel(effectiveDefaultHotkey),
                })}
              </button>
            )}
          </SettingsPanelRow>

          {(!isUsingNativeShortcut || platform === "linux") && (
            <SettingsPanelRow>
              <p className="text-xs font-medium text-muted-foreground/80 mb-2">
                {t("settingsPage.general.hotkey.activationMode")}
              </p>
              <ActivationModeSelector value={activationMode} onChange={setActivationMode} />
              {platform === "linux" && activationMode === "push" && (
                <LinuxPttSetupInfo isAvailable={linuxPttAvailable} />
              )}
            </SettingsPanelRow>
          )}
        </SettingsPanel>
      </div>

      <div className="rounded-lg border border-primary/15 bg-primary/5 dark:bg-primary/10 px-3 py-2.5 flex gap-2.5">
        <Mic className="h-4 w-4 shrink-0 text-primary mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {t("localSetup.hotkeys.tip", { hotkey: formatHotkeyLabel(dictationKey) })}
        </p>
      </div>
    </div>
  );

  return (
    <SettingsLayoutProvider value={{ isCompact: false }}>
      <div className="h-full min-h-0 overflow-y-auto pr-1">
        {activeTab === "general" && renderGeneral()}
        {activeTab === "models" && renderModels()}
        {activeTab === "hotkeys" && renderHotkeys()}
      </div>
    </SettingsLayoutProvider>
  );
}
