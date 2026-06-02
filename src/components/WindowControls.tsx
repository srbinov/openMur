import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "./lib/utils";

function TrafficLightButton({
  colorClass,
  label,
  onClick,
  symbol,
}: {
  colorClass: string;
  label: string;
  onClick: () => void;
  symbol: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
        "shadow-[inset_0_0_0_1px_rgba(0,0,0,0.14)] transition-[filter,transform] duration-150",
        "hover:brightness-[0.92] active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1",
        colorClass
      )}
    >
      <span
        className={cn(
          "pointer-events-none select-none text-[11px] font-bold leading-none text-black/55",
          "opacity-0 transition-opacity duration-150",
          "group-hover/traffic:opacity-100"
        )}
        aria-hidden
      >
        {symbol}
      </span>
    </button>
  );
}

interface WindowControlsProps {
  className?: string;
}

export default function WindowControls({ className }: WindowControlsProps) {
  const { t } = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let mounted = true;

    const syncIsMaximized = async () => {
      try {
        const maximized = await window.electronAPI?.windowIsMaximized?.();
        if (mounted) setIsMaximized(!!maximized);
      } catch {}
    };

    syncIsMaximized();
    const intervalId = setInterval(syncIsMaximized, 1000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const handleMinimize = async () => {
    try {
      await window.electronAPI?.windowMinimize?.();
    } catch {}
  };

  const handleMaximize = async () => {
    try {
      await window.electronAPI?.windowMaximize?.();
      const maximized = await window.electronAPI?.windowIsMaximized?.();
      setIsMaximized(!!maximized);
    } catch {}
  };

  const handleClose = async () => {
    try {
      await window.electronAPI?.windowClose?.();
    } catch {}
  };

  return (
    <div
      className={cn(
        "group/traffic flex items-center gap-2 pointer-events-auto",
        className
      )}
    >
      <TrafficLightButton
        colorClass="bg-[#FFBD2E]"
        label={t("windowControls.minimize")}
        onClick={handleMinimize}
        symbol="−"
      />
      <TrafficLightButton
        colorClass="bg-[#28C840]"
        label={isMaximized ? t("windowControls.restore") : t("windowControls.maximize")}
        onClick={handleMaximize}
        symbol={isMaximized ? "⤢" : "+"}
      />
      <TrafficLightButton
        colorClass="bg-[#FF5F57]"
        label={t("windowControls.close")}
        onClick={handleClose}
        symbol="×"
      />
    </div>
  );
}
