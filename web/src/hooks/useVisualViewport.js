import { useEffect } from "react";

/** Keeps layout in sync with the on-screen keyboard (iOS / Android PWA). */
export function useVisualViewport() {
  useEffect(() => {
    const root = document.documentElement;

    const update = () => {
      const vv = window.visualViewport;
      if (!vv) {
        root.style.setProperty("--app-height", "100dvh");
        root.style.setProperty("--keyboard-inset", "0px");
        return;
      }

      root.style.setProperty("--app-height", `${vv.height}px`);
      const keyboardInset = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop
      );
      root.style.setProperty("--keyboard-inset", `${keyboardInset}px`);
    };

    update();
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("orientationchange", update);
    window.addEventListener("resize", update);

    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("resize", update);
      root.style.removeProperty("--app-height");
      root.style.removeProperty("--keyboard-inset");
    };
  }, []);
}
