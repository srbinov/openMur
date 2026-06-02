import React, { Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import App from "./App.jsx";
import MeetingNotificationOverlay from "./components/MeetingNotificationOverlay.tsx";
import TranscriptionPreviewOverlay from "./components/TranscriptionPreviewOverlay.tsx";
import DictationPillOverlay from "./components/DictationPillOverlay.tsx";
import UpdateNotificationOverlay from "./components/UpdateNotificationOverlay.tsx";
import { useTheme } from "./hooks/useTheme";
import { useControlPanelWindowChrome } from "./hooks/useControlPanelWindowChrome";
import { LOCAL_ONLY } from "./config/localOnlyMode";
import appIcon from "./assets/icon.png";

const ControlPanel = React.lazy(() => import("./components/ControlPanel.tsx"));
const OnboardingFlow = React.lazy(() => import("./components/OnboardingFlow.tsx"));
const AgentOverlay = React.lazy(() => import("./components/AgentOverlay.tsx"));

export default function AppRouter() {
  useTheme();
  const params = window.location.search;

  if (params.includes("meeting-notification=true") && !LOCAL_ONLY) {
    return <MeetingNotificationOverlay />;
  }

  if (params.includes("update-notification=true") && !LOCAL_ONLY) {
    return <UpdateNotificationOverlay />;
  }

  if (params.includes("transcription-preview=true")) {
    return LOCAL_ONLY ? <DictationPillOverlay /> : <TranscriptionPreviewOverlay />;
  }

  return <MainApp />;
}

function MainApp() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const isAgentPanel = window.location.search.includes("agent=true");
  const isControlPanel =
    !isAgentPanel &&
    (window.location.pathname.includes("control") || window.location.search.includes("panel=true"));
  const isDictationPanel = !isControlPanel && !isAgentPanel;

  useControlPanelWindowChrome(isControlPanel && !isLoading);

  useEffect(() => {
    if (isAgentPanel) {
      import("./components/AgentOverlay.tsx").catch(() => {});
    } else if (isControlPanel) {
      import("./components/ControlPanel.tsx").catch(() => {});

      if (!localStorage.getItem("onboardingCompleted")) {
        import("./components/OnboardingFlow.tsx").catch(() => {});
      }
    }
  }, [isAgentPanel, isControlPanel]);

  useEffect(() => {
    if (LOCAL_ONLY) {
      localStorage.setItem("onboardingCompleted", "true");
    }

    const resolved =
      LOCAL_ONLY || localStorage.getItem("onboardingCompleted") === "true";

    if (isControlPanel && !resolved) {
      setShowOnboarding(true);
    }

    if (isDictationPanel && !resolved) {
      const rawStep = parseInt(localStorage.getItem("onboardingCurrentStep") || "0");
      const currentStep = Math.max(0, Math.min(rawStep, 5));
      if (currentStep < 4) {
        window.electronAPI?.hideWindow?.();
      }
    }

    setIsLoading(false);
  }, [isControlPanel, isDictationPanel]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    localStorage.setItem("onboardingCompleted", "true");
  };

  if (isAgentPanel && !LOCAL_ONLY) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <AgentOverlay />
      </Suspense>
    );
  }

  if (isAgentPanel && LOCAL_ONLY) {
    return null;
  }

  if (isLoading) {
    return <LoadingFallback />;
  }

  if (isControlPanel && showOnboarding) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      </Suspense>
    );
  }

  return isControlPanel ? (
    <Suspense fallback={<LoadingFallback />}>
      <ControlPanel />
    </Suspense>
  ) : (
    <App />
  );
}

function LoadingFallback({ message }) {
  const { t } = useTranslation();
  const fallbackMessage = message || t("common.loading");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 animate-[scale-in_300ms_ease-out]">
        <img
          src={appIcon}
          alt="openMur"
          className="w-12 h-12 rounded-xl object-contain shadow-[0_4px_16px_rgba(136,158,255,0.35)]"
          draggable={false}
        />
        <div className="w-7 h-7 rounded-full border-[2.5px] border-transparent border-t-[#889eff] animate-[spinner-rotate_0.8s_cubic-bezier(0.4,0,0.2,1)_infinite] motion-reduce:animate-none motion-reduce:border-t-muted-foreground motion-reduce:opacity-50" />
        {fallbackMessage && (
          <p className="text-[13px] font-medium text-muted-foreground dark:text-foreground/60 tracking-[-0.01em]">
            {fallbackMessage}
          </p>
        )}
      </div>
    </div>
  );
}
