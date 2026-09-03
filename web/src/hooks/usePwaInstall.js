import { useCallback, useEffect, useState } from "react";

const DISMISS_KEY = "tailor_pwa_install_dismissed";

function isStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function detectIos() {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac, so check for touch as well.
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === "1"
  );
  const [standalone, setStandalone] = useState(isStandaloneMode);
  const [installed, setInstalled] = useState(false);
  const [isIos] = useState(detectIos);

  useEffect(() => {
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    // Covers the case where the user launches the installed app in a tab and
    // then switches to standalone.
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const onDisplayChange = (e) => setStandalone(e.matches);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    displayMode.addEventListener("change", onDisplayChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      displayMode.removeEventListener("change", onDisplayChange);
    };
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, "1");
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") {
      localStorage.setItem(DISMISS_KEY, "1");
      setDismissed(true);
    }
    return outcome === "accepted";
  }, [deferredPrompt]);

  const isInstalled = standalone || installed;

  return {
    /** A native install prompt is held and ready to fire. */
    promptAvailable: Boolean(deferredPrompt) && !isInstalled,
    /** Show the dismissible chat banner. */
    canInstall: Boolean(deferredPrompt) && !dismissed && !isInstalled,
    install,
    dismiss,
    isInstalled,
    isIos,
  };
}
