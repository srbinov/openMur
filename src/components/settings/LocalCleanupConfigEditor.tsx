import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import ApiKeyInput from "../ui/ApiKeyInput";
import ModelCardList from "../ui/ModelCardList";
import { ProviderTabs } from "../ui/ProviderTabs";
import {
  useSettingsStore,
  selectResolvedLLMConfig,
  setResolvedLLMConfig,
} from "../../stores/settingsStore";
import { REASONING_PROVIDERS } from "../../models/ModelRegistry";
import { getProviderIcon, isMonochromeProvider } from "../../utils/providerIcons";
import { createExternalLinkHandler } from "../../utils/externalLinks";

const LOCAL_CLEANUP_PROVIDER_IDS = ["openai", "anthropic", "gemini"] as const;
type LocalCleanupProvider = (typeof LOCAL_CLEANUP_PROVIDER_IDS)[number];

const API_KEY_LINKS: Record<LocalCleanupProvider, string> = {
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
  gemini: "https://aistudio.google.com/app/api-keys",
};

function isLocalCleanupProvider(id: string): id is LocalCleanupProvider {
  return (LOCAL_CLEANUP_PROVIDER_IDS as readonly string[]).includes(id);
}

function defaultModelForProvider(provider: LocalCleanupProvider): string {
  const models = REASONING_PROVIDERS[provider]?.models;
  return models?.[0]?.value ?? "";
}

export default function LocalCleanupConfigEditor() {
  const { t } = useTranslation();
  const config = useSettingsStore(useShallow((s) => selectResolvedLLMConfig(s, "dictationCleanup")));

  const openaiApiKey = useSettingsStore((s) => s.openaiApiKey);
  const setOpenaiApiKey = useSettingsStore((s) => s.setOpenaiApiKey);
  const anthropicApiKey = useSettingsStore((s) => s.anthropicApiKey);
  const setAnthropicApiKey = useSettingsStore((s) => s.setAnthropicApiKey);
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey);
  const setGeminiApiKey = useSettingsStore((s) => s.setGeminiApiKey);

  const provider = isLocalCleanupProvider(config.provider) ? config.provider : "anthropic";

  useEffect(() => {
    const patch: Parameters<typeof setResolvedLLMConfig>[1] = {};
    if (config.mode !== "providers") {
      patch.mode = "providers";
      patch.cloudMode = "byok";
    }
    if (!isLocalCleanupProvider(config.provider)) {
      patch.provider = "anthropic";
      patch.model = defaultModelForProvider("anthropic");
    }
    if (Object.keys(patch).length > 0) {
      setResolvedLLMConfig("dictationCleanup", patch);
    }
  }, [config.mode, config.provider]);

  const providerTabs = useMemo(
    () =>
      LOCAL_CLEANUP_PROVIDER_IDS.map((id) => ({
        id,
        name: REASONING_PROVIDERS[id]?.name ?? id,
      })),
    []
  );

  const modelOptions = useMemo(() => {
    const iconUrl = getProviderIcon(provider);
    const invertInDark = isMonochromeProvider(provider);
    return (REASONING_PROVIDERS[provider]?.models ?? []).map((model) => ({
      ...model,
      description: model.descriptionKey
        ? t(model.descriptionKey, { defaultValue: model.description })
        : model.description,
      icon: iconUrl,
      invertInDark,
    }));
  }, [provider, t]);

  const handleProviderChange = useCallback(
    (id: string) => {
      if (!isLocalCleanupProvider(id)) return;
      setResolvedLLMConfig("dictationCleanup", {
        mode: "providers",
        cloudMode: "byok",
        provider: id,
        model: defaultModelForProvider(id),
      });
    },
    []
  );

  const apiKeyProps = useMemo(() => {
    switch (provider) {
      case "openai":
        return { apiKey: openaiApiKey, setApiKey: setOpenaiApiKey };
      case "anthropic":
        return { apiKey: anthropicApiKey, setApiKey: setAnthropicApiKey };
      case "gemini":
        return { apiKey: geminiApiKey, setApiKey: setGeminiApiKey };
    }
  }, [
    provider,
    openaiApiKey,
    setOpenaiApiKey,
    anthropicApiKey,
    setAnthropicApiKey,
    geminiApiKey,
    setGeminiApiKey,
  ]);

  const keyLink = API_KEY_LINKS[provider];

  return (
    <div className="space-y-4 rounded-lg border border-border/50 dark:border-border-subtle/70 bg-card/40 p-4">
      <ProviderTabs
        providers={providerTabs}
        selectedId={provider}
        onSelect={handleProviderChange}
        colorScheme="purple"
      />

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-medium text-foreground">{t("common.apiKey")}</h4>
          <a
            href={keyLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={createExternalLinkHandler(keyLink)}
            className="text-xs text-link underline decoration-link/30 hover:decoration-link/60 cursor-pointer transition-colors shrink-0"
          >
            {t("reasoning.getApiKey")}
          </a>
        </div>
        <ApiKeyInput
          apiKey={apiKeyProps.apiKey}
          setApiKey={apiKeyProps.setApiKey}
          label=""
          helpText=""
          variant="purple"
        />
      </div>

      <div className="space-y-2 pt-1">
        <h4 className="text-sm font-medium text-foreground">{t("reasoning.selectModel")}</h4>
        <ModelCardList
          models={modelOptions}
          selectedModel={config.model}
          onModelSelect={(model) =>
            setResolvedLLMConfig("dictationCleanup", { model })
          }
        />
      </div>
    </div>
  );
}
