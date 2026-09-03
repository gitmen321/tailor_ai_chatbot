import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import { usePwaInstall } from "../hooks/usePwaInstall.js";

const DISMISS_KEY = "tailor_ios_install_hint_dismissed";

/** Safari on iOS has no beforeinstallprompt — show Share → Add to Home Screen. */
export default function IosInstallHint() {
  const { isIos, isInstalled } = usePwaInstall();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIos || isInstalled) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    const timer = window.setTimeout(() => setVisible(true), 2400);
    return () => window.clearTimeout(timer);
  }, [isIos, isInstalled]);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="ios-install-hint" role="note">
      <p>
        <strong>iPhone-ൽ ഇൻസ്റ്റാൾ ചെയ്യാൻ:</strong> Share{" "}
        <Icon name="share" size={13} className="inline-icon" /> ബട്ടൺ → Add to
        Home Screen
      </p>
      <button
        type="button"
        className="ios-install-dismiss"
        onClick={dismiss}
        aria-label="Dismiss"
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
