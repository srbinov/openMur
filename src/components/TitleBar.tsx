import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import WindowControls from "./WindowControls";
import { cn } from "./lib/utils";
import { Button } from "./ui/button";
import { Power } from "lucide-react";
import { ConfirmDialog } from "./ui/dialog";

interface TitleBarProps {
  title?: string;
  showTitle?: boolean;
  children?: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export default function TitleBar({
  title = "",
  showTitle = false,
  children,
  className = "",
  actions,
}: TitleBarProps) {
  const { t } = useTranslation();
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  const platform =
    typeof window !== "undefined" && window.electronAPI?.getPlatform
      ? window.electronAPI.getPlatform()
      : "darwin";

  const handleQuit = async () => {
    try {
      await window.electronAPI?.appQuit?.();
    } catch {
      // noop
    }
  };

  const getActionsContent = () => {
    if (!actions) return null;

    if (platform !== "darwin" && React.isValidElement(actions)) {
      const el = actions as React.ReactElement<{ children?: React.ReactNode }>;
      const childrenArray = React.Children.toArray(el.props.children);
      return <>{[...childrenArray].reverse()}</>;
    }

    return actions;
  };

  return (
    <div className={cn("bg-transparent border-b border-white/12 dark:border-white/8 select-none", className)}>
      <div
        className="relative flex items-center justify-between h-12 px-4"
        style={{ WebkitAppRegion: "drag" }}
      >
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" }}>
          {platform !== "darwin" ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowQuitConfirm(true)}
                className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                title={t("titleBar.quitTitle")}
                aria-label={t("titleBar.quitTitle")}
              >
                <Power size={16} />
              </Button>
              {getActionsContent()}
            </>
          ) : (
            <>
              {showTitle && title && (
                <h1 className="text-sm font-semibold text-foreground">{title}</h1>
              )}
              {children}
            </>
          )}
        </div>

        <div
          className={cn(
            "flex items-center",
            platform !== "darwin" ? "absolute top-2.5 right-3" : "gap-2"
          )}
          style={{ WebkitAppRegion: "no-drag" }}
        >
          {platform !== "darwin" ? (
            <WindowControls />
          ) : (
            <>
              {actions}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowQuitConfirm(true)}
                className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                title={t("titleBar.quitTitle")}
                aria-label={t("titleBar.quitTitle")}
              >
                <Power size={16} />
              </Button>
            </>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={showQuitConfirm}
        onOpenChange={setShowQuitConfirm}
        title={t("titleBar.quitConfirmTitle")}
        description={t("titleBar.quitConfirmDescription")}
        confirmText={t("titleBar.quit")}
        cancelText={t("titleBar.cancel")}
        onConfirm={handleQuit}
        variant="destructive"
      />
    </div>
  );
}
