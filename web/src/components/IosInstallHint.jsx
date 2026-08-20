import { useEffect, useState } from "react";

const DISMISS_KEY = "tailor_ios_install_hint_dismissed";

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

/** Safari on iOS has no beforeinstallprompt — show Share → Add to Home Screen hint. */
export default function IosInstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIos() || isStandaloneMode()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    const timer = window.setTimeout(() => setVisible(true), 2400);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="ios-install-hint" role="note">
      <p>
        <strong>iPhone-ൽ ഇൻസ്റ്റാൾ ചെയ്യാൻ:</strong> Share ബട്ടൺ → Add to Home
        Screen
      </p>
      <button type="button" className="ios-install-dismiss" onClick={dismiss}>
        ✕
      </button>
    </div>
  );
}
