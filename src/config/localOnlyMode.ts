import type { InferenceMode } from "../types/electron";

/**
 * Local-first fork: whisper.cpp on device, optional BYOK cleanup.
 * Keep LOCAL_ONLY in sync with src/helpers/localOnlyFlag.js (main process).
 */
export const LOCAL_ONLY = true;

/** Auto-delete saved dictations after this many minutes. */
export const TRANSCRIPTION_RETENTION_MINUTES = 5;

export const LOCAL_ONLY_DEFAULTS = {
  useLocalWhisper: true,
  localTranscriptionProvider: "whisper" as const,
  whisperModel: "base",
  transcriptionMode: "local" as InferenceMode,
  cloudTranscriptionMode: "byok",
  cleanupMode: "providers" as InferenceMode,
  cleanupProvider: "anthropic",
  cleanupModel: "claude-haiku-4-5",
  cleanupCloudMode: "byok",
  useCleanupModel: false,
  useDictationAgent: false,
  allowOpenAIFallback: false,
  allowLocalFallback: false,
  cloudBackupEnabled: false,
  isSignedIn: false,
  activationMode: "push" as const,
  showTranscriptionPreview: true,
  autoPasteEnabled: true,
  floatingIconAutoHide: true,
  startMinimized: false,
  dataRetentionEnabled: true,
  audioRetentionEnabled: false,
} as const;

const LOCAL_ONLY_STORAGE_KEYS: Array<[keyof typeof LOCAL_ONLY_DEFAULTS, string]> = [
  ["useLocalWhisper", "useLocalWhisper"],
  ["localTranscriptionProvider", "localTranscriptionProvider"],
  ["whisperModel", "whisperModel"],
  ["transcriptionMode", "transcriptionMode"],
  ["cloudTranscriptionMode", "cloudTranscriptionMode"],
  ["cleanupMode", "cleanupMode"],
  ["cleanupProvider", "cleanupProvider"],
  ["cleanupModel", "cleanupModel"],
  ["cleanupCloudMode", "cleanupCloudMode"],
  ["useCleanupModel", "useCleanupModel"],
  ["useDictationAgent", "useDictationAgent"],
  ["allowOpenAIFallback", "allowOpenAIFallback"],
  ["allowLocalFallback", "allowLocalFallback"],
  ["cloudBackupEnabled", "cloudBackupEnabled"],
  ["isSignedIn", "isSignedIn"],
  ["activationMode", "activationMode"],
  ["showTranscriptionPreview", "showTranscriptionPreview"],
  ["autoPasteEnabled", "autoPasteEnabled"],
  ["floatingIconAutoHide", "floatingIconAutoHide"],
  ["startMinimized", "startMinimized"],
  ["dataRetentionEnabled", "dataRetentionEnabled"],
  ["audioRetentionEnabled", "audioRetentionEnabled"],
];

/** Apply local-only defaults to localStorage + zustand (idempotent). */
export function applyLocalOnlySettings(
  setState: (partial: Record<string, unknown>) => void
): void {
  if (!LOCAL_ONLY || typeof window === "undefined") return;

  const partial: Record<string, unknown> = { ...LOCAL_ONLY_DEFAULTS };
  for (const [stateKey, storageKey] of LOCAL_ONLY_STORAGE_KEYS) {
    localStorage.setItem(storageKey, String(LOCAL_ONLY_DEFAULTS[stateKey]));
  }

  setState(partial);
  window.electronAPI?.notifyActivationModeChanged?.(LOCAL_ONLY_DEFAULTS.activationMode);
  window.electronAPI?.saveActivationMode?.(LOCAL_ONLY_DEFAULTS.activationMode);
  window.electronAPI?.notifyFloatingIconAutoHideChanged?.(true);
}
