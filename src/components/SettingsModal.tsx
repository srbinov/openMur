import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sliders, Brain, Keyboard, Mic, Shield, Wrench } from "lucide-react";
import SidebarModal, { type SidebarItem } from "./ui/SidebarModal";
import SettingsPage, { SettingsSectionType } from "./SettingsPage";
import LocalSettingsView, { type LocalSettingsTab } from "./LocalSettingsView";
import { WORKSPACES_ENABLED } from "../lib/features";
import { LOCAL_ONLY } from "../config/localOnlyMode";

export type { SettingsSectionType };

const SECTION_ALIASES: Record<string, SettingsSectionType> = {
  aiModels: "llms",
  agentConfig: "llms",
  agentMode: "llms",
  intelligence: "llms",
  meetings: "llms",
  prompts: "llms",
  transcription: "speechToText",
  softwareUpdates: "system",
  privacy: "privacyData",
  permissions: "privacyData",
  developer: "system",
};

const LOCAL_SECTION_ALIASES: Record<string, LocalSettingsTab> = {
  general: "general",
  hotkeys: "hotkeys",
  speechToText: "models",
  llms: "models",
  transcription: "models",
  aiModels: "models",
};

const LEGACY_SUB_TAB: Record<string, string> = {
  transcription: "dictation",
  meetings: "noteFormatting",
  intelligence: "dictationCleanup",
  agentMode: "chatIntelligence",
  agentConfig: "chatIntelligence",
  aiModels: "dictationCleanup",
  prompts: "dictationCleanup",
};

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: string;
}

export default function SettingsModal({ open, onOpenChange, initialSection }: SettingsModalProps) {
  const { t } = useTranslation();

  const resolveLocalTab = (section: string | undefined): LocalSettingsTab => {
    if (!section) return "general";
    return LOCAL_SECTION_ALIASES[section] ?? "general";
  };

  const resolveSection = (section: string | undefined): SettingsSectionType => {
    if (!section) return "general";
    const resolved = (SECTION_ALIASES[section] ?? section) as SettingsSectionType;
    if (resolved === "workspace" && !WORKSPACES_ENABLED) return "general";
    if (resolved === "account" || resolved === "plansBilling") return "general";
    return resolved;
  };

  const [activeLocalTab, setActiveLocalTab] = useState<LocalSettingsTab>(() =>
    resolveLocalTab(initialSection)
  );
  const [activeSection, setActiveSection] = React.useState<SettingsSectionType>(() =>
    resolveSection(initialSection)
  );
  const [initialSubTab, setInitialSubTab] = useState<string | undefined>(() =>
    initialSection ? LEGACY_SUB_TAB[initialSection] : undefined
  );
  useEffect(() => {
    if (!open) {
      setInitialSubTab(undefined);
      return;
    }
    if (!initialSection) return;
    if (LOCAL_ONLY) {
      setActiveLocalTab(resolveLocalTab(initialSection));
    } else {
      setActiveSection(resolveSection(initialSection));
      setInitialSubTab(LEGACY_SUB_TAB[initialSection]);
    }
  }, [open, initialSection]);

  const localSidebarItems: SidebarItem<LocalSettingsTab>[] = useMemo(
    () => [
      {
        id: "general",
        label: t("localSetup.tabs.general"),
        icon: Sliders,
        description: t("localSetup.tabs.generalDescription"),
        group: t("localSetup.sidebarGroup"),
      },
      {
        id: "models",
        label: t("localSetup.tabs.models"),
        icon: Brain,
        description: t("localSetup.tabs.modelsDescription"),
        group: t("localSetup.sidebarGroup"),
      },
      {
        id: "hotkeys",
        label: t("localSetup.tabs.hotkeys"),
        icon: Keyboard,
        description: t("localSetup.tabs.hotkeysDescription"),
        group: t("localSetup.sidebarGroup"),
      },
    ],
    [t]
  );

  const sidebarItems: SidebarItem<SettingsSectionType>[] = useMemo(() => {
    const items: SidebarItem<SettingsSectionType>[] = [
      {
        id: "general",
        label: t("settingsModal.sections.general.label"),
        icon: Sliders,
        description: t("settingsModal.sections.general.description"),
        group: t("settingsModal.groups.app"),
      },
      {
        id: "hotkeys",
        label: t("settingsModal.sections.hotkeys.label"),
        icon: Keyboard,
        description: t("settingsModal.sections.hotkeys.description"),
        group: t("settingsModal.groups.app"),
      },
      {
        id: "speechToText",
        label: t("settingsModal.sections.speechToText.label"),
        icon: Mic,
        description: t("settingsModal.sections.speechToText.description"),
        group: t("settingsModal.groups.aiModels"),
      },
    ];

    if (!LOCAL_ONLY) {
      items.push(
        {
          id: "llms",
          label: t("settingsModal.sections.llms.label"),
          icon: Brain,
          description: t("settingsModal.sections.llms.description"),
          group: t("settingsModal.groups.aiModels"),
        },
        {
          id: "privacyData",
          label: t("settingsModal.sections.privacyData.label"),
          icon: Shield,
          description: t("settingsModal.sections.privacyData.description"),
          group: t("settingsModal.groups.system"),
        },
        {
          id: "system",
          label: t("settingsModal.sections.system.label"),
          icon: Wrench,
          description: t("settingsModal.sections.system.description"),
          group: t("settingsModal.groups.system"),
        }
      );
    }

    return items;
  }, [t]);

  if (LOCAL_ONLY) {
    return (
      <SidebarModal<LocalSettingsTab>
        open={open}
        onOpenChange={onOpenChange}
        title={t("localSetup.modalTitle")}
        sidebarItems={localSidebarItems}
        activeSection={activeLocalTab}
        onSectionChange={setActiveLocalTab}
      >
        <LocalSettingsView activeTab={activeLocalTab} />
      </SidebarModal>
    );
  }

  const handleSectionChange = (section: SettingsSectionType) => {
    setActiveSection(section);
    setInitialSubTab(undefined);
  };

  return (
    <SidebarModal<SettingsSectionType>
      open={open}
      onOpenChange={onOpenChange}
      title={t("settingsModal.title")}
      sidebarItems={sidebarItems}
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
    >
      <SettingsPage
        activeSection={activeSection}
        onNavigateToSection={handleSectionChange}
        initialSubTab={initialSubTab}
      />
    </SidebarModal>
  );
}
