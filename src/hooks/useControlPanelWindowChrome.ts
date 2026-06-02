import { useEffect } from "react";

/** Rounded frameless control-panel shell (Linux uses transparent window + CSS clip). */
export function useControlPanelWindowChrome(active: boolean) {
  useEffect(() => {
    if (!active) return;

    document.body.classList.add("control-panel-shell");

    let mounted = true;

    const syncMaximized = async () => {
      try {
        const maximized = await window.electronAPI?.windowIsMaximized?.();
        if (mounted) {
          document.body.classList.toggle("control-panel-maximized", !!maximized);
        }
      } catch {
        if (mounted) document.body.classList.remove("control-panel-maximized");
      }
    };

    syncMaximized();
    const intervalId = setInterval(syncMaximized, 400);

    return () => {
      mounted = false;
      clearInterval(intervalId);
      document.body.classList.remove("control-panel-shell", "control-panel-maximized");
    };
  }, [active]);
}
