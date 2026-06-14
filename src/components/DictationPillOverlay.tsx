import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2 } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { GlassEffect } from "./ui/liquid-glass";
import type { GlassTint } from "./ui/liquid-glass";

export type PillState = "idle" | "listening" | "processing" | "pasting" | "done";

function WaveBars({
  active,
  className = "bg-[#f4f6fc]/85",
}: {
  active: boolean;
  className?: string;
}) {
  const heights = [5, 9, 7, 10, 6];
  return (
    <div className="flex items-end gap-[2px] h-3.5" aria-hidden>
      {heights.map((h, i) => (
        <span
          key={i}
          className={`w-[2px] rounded-full ${className}`}
          style={{
            height: h,
            animation: active ? "pill-bars 0.75s ease-in-out infinite" : undefined,
            animationDelay: active ? `${i * 0.08}s` : undefined,
            opacity: active ? 1 : 0.4,
            transform: active ? undefined : "scaleY(0.6)",
          }}
        />
      ))}
    </div>
  );
}

export default function DictationPillOverlay() {
  useTheme();
  const { t } = useTranslation();
  const [pillState, setPillState] = useState<PillState>("idle");
  const [snippet, setSnippet] = useState("");
  const shellRef = useRef<HTMLDivElement | null>(null);
  const pillStateRef = useRef<PillState>("idle");

  useEffect(() => {
    pillStateRef.current = pillState;
  }, [pillState]);

  const requestResize = useCallback(() => {
    if (!shellRef.current || !window.electronAPI?.resizeTranscriptionPreviewWindow) return;
    const rect = shellRef.current.getBoundingClientRect();
    const width = Math.ceil(rect.width) + 12;
    const height = Math.ceil(rect.height) + 10;
    window.electronAPI.resizeTranscriptionPreviewWindow(width, height).catch(() => {});
  }, []);

  useEffect(() => {
    if (!shellRef.current) return;
    const frame = requestAnimationFrame(() => requestResize());
    const observer = new ResizeObserver(() => requestResize());
    observer.observe(shellRef.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [pillState, snippet, requestResize]);

  useEffect(() => {
    const unsubState = window.electronAPI?.onPreviewState?.((state: string) => {
      if (
        state === "idle" ||
        state === "listening" ||
        state === "processing" ||
        state === "pasting" ||
        state === "done"
      ) {
        setPillState(state);
        if (state === "idle" || state === "listening") {
          if (state === "idle") setSnippet("");
        }
      }
    });

    const unsubSnippet = window.electronAPI?.onPreviewSnippet?.((text: string) => {
      const trimmed = text?.trim() || "";
      setSnippet(trimmed);
      if (trimmed && pillStateRef.current === "done") {
        setPillState("done");
      }
      requestResize();
    });

    const unsubHide = window.electronAPI?.onPreviewHide?.(() => {
      setPillState("idle");
      setSnippet("");
    });

    return () => {
      unsubState?.();
      unsubSnippet?.();
      unsubHide?.();
    };
  }, [requestResize]);

  const isBusy =
    pillState === "processing" || pillState === "pasting";
  const isDone = pillState === "done";

  const statusLabel = isDone
    ? t("dictationPill.done")
    : pillState === "pasting"
      ? t("dictationPill.pasting")
      : pillState === "processing"
        ? t("dictationPill.transcribing")
        : pillState === "listening"
          ? t("dictationPill.listening")
          : t("dictationPill.ready");

  const hintText = isDone
    ? t("dictationPill.doneHint")
    : pillState === "pasting"
      ? t("dictationPill.pastingHint")
      : pillState === "processing"
        ? t("dictationPill.processingHint")
        : pillState === "listening"
          ? t("dictationPill.speakNow")
          : t("dictationPill.idleHint");

  const isListening = pillState === "listening";

  const glassTint: GlassTint = isListening
    ? "listening"
    : isDone
      ? "success"
      : isBusy
        ? "accent"
        : "default";

  return (
    <div className="flex h-full w-full items-end justify-center bg-transparent p-1">
      <div
        ref={shellRef}
        className={[
          "flex flex-col items-center transition-all duration-200 ease-out",
          isListening ? "gap-1.5" : "",
        ].join(" ")}
        role="status"
        aria-live="polite"
        aria-busy={isBusy}
      >
        {isListening && (
          <GlassEffect
            tint="listening"
            density="surface"
            interactive={false}
            rounded="rounded-xl"
            className="px-2.5 py-1"
          >
            <p className="text-[10px] font-semibold tracking-wide uppercase leading-none text-white">
              {statusLabel}
            </p>
          </GlassEffect>
        )}

        <GlassEffect
          tint={glassTint}
          density="surface"
          interactive={false}
          rounded="rounded-full"
          className={[
            "items-center gap-2.5 transition-all duration-200 ease-out",
            isListening
              ? "px-2.5 py-1.5 min-w-[52px]"
              : isDone
                ? "px-3.5 py-2 min-w-[140px] max-w-[min(280px,calc(100vw-20px))]"
                : isBusy
                  ? "px-3 py-2 min-w-[130px]"
                  : "px-2.5 py-1.5 min-w-[72px]",
          ].join(" ")}
        >
          <div className="flex items-center gap-2.5 min-w-0 w-full">
          <div className="shrink-0 flex items-center justify-center w-7 h-7">
            {isDone ? (
              <Check className="h-4 w-4 text-emerald-500" strokeWidth={2.5} />
            ) : isBusy ? (
              <Loader2 className="h-4 w-4 text-[#889eff] animate-spin" />
            ) : (
              <WaveBars
                active={isListening}
                className={isListening ? "bg-white/90" : "bg-[#889eff]/85"}
              />
            )}
          </div>

          {!isListening && (
            <div className="min-w-0 flex-1 pr-0.5">
              <p
                className={[
                  "text-[10px] font-semibold tracking-wide uppercase leading-none",
                  isDone
                    ? "text-emerald-600 dark:text-emerald-400"
                    : isBusy
                      ? "text-[#889eff]"
                      : "text-muted-foreground/80",
                ].join(" ")}
              >
                {statusLabel}
              </p>

              {(isDone ? snippet : hintText) && (
                <p
                  className={[
                    "mt-0.5 leading-snug",
                    isDone
                      ? "text-[11px] text-foreground/90 line-clamp-2"
                      : "text-[9px] text-muted-foreground/60 truncate",
                  ].join(" ")}
                >
                  {isDone ? snippet : hintText}
                </p>
              )}
            </div>
          )}

          {isBusy && (
            <div className="shrink-0 hidden sm:block">
              <WaveBars active className="bg-[#889eff]/50" />
            </div>
          )}
          </div>
        </GlassEffect>
      </div>

      <style>{`
        @keyframes pill-bars {
          0%, 100% { transform: scaleY(0.5); opacity: 0.5; }
          50% { transform: scaleY(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
