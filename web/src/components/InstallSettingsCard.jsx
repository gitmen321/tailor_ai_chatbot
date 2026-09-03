import Icon from "./Icon.jsx";
import { usePwaInstall } from "../hooks/usePwaInstall.js";

/**
 * A permanent home for the install action. The chat banner only appears when
 * Chrome fires beforeinstallprompt and can be dismissed forever, so without
 * this there is no way back to installing the app.
 */
export default function InstallSettingsCard() {
  const { promptAvailable, install, isInstalled, isIos } = usePwaInstall();

  if (isInstalled) {
    return (
      <div className="settings-card install-card">
        <span className="install-card-icon is-done" aria-hidden="true">
          <Icon name="check" size={19} />
        </span>
        <div className="install-card-copy">
          <p className="settings-row-label settings-row-label-inline">
            App installed
          </p>
          <p className="settings-hint">ഹോം സ്ക്രീനിൽ ചേർത്തിട്ടുണ്ട്</p>
        </div>
      </div>
    );
  }

  if (promptAvailable) {
    return (
      <div className="settings-card install-card">
        <span className="install-card-icon" aria-hidden="true">
          <Icon name="download" size={19} />
        </span>
        <div className="install-card-copy">
          <p className="settings-row-label settings-row-label-inline">
            Install app
          </p>
          <p className="settings-hint">ഹോം സ്ക്രീനിൽ ചേർക്കുക</p>
        </div>
        <button type="button" className="install-card-btn" onClick={install}>
          Install
        </button>
      </div>
    );
  }

  return (
    <div className="settings-card">
      <div className="install-card">
        <span className="install-card-icon" aria-hidden="true">
          <Icon name={isIos ? "share" : "download"} size={19} />
        </span>
        <div className="install-card-copy">
          <p className="settings-row-label settings-row-label-inline">
            Add to home screen
          </p>
          <p className="settings-hint">ഹോം സ്ക്രീനിൽ ചേർക്കുക</p>
        </div>
      </div>
      <p className="settings-note">
        <Icon name="sparkle" size={14} />
        <span>
          {isIos
            ? "Safari-യിൽ Share ബട്ടൺ അമർത്തി “Add to Home Screen” തിരഞ്ഞെടുക്കുക."
            : "ബ്രൗസർ മെനു (⋮) തുറന്ന് “Install app” അല്ലെങ്കിൽ “Add to Home screen” തിരഞ്ഞെടുക്കുക."}
        </span>
      </p>
    </div>
  );
}
