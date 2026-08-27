import Icon from "./Icon.jsx";
import { usePwaInstall } from "../hooks/usePwaInstall.js";

export default function PwaInstallBanner() {
  const { canInstall, install, dismiss } = usePwaInstall();

  if (!canInstall) return null;

  return (
    <div className="pwa-install-banner" role="region" aria-label="Install app">
      <span className="pwa-install-icon" aria-hidden="true">
        <Icon name="download" size={19} />
      </span>
      <div className="pwa-install-copy">
        <strong>ഹോം സ്ക്രീനിൽ ചേർക്കുക</strong>
        <span>ആപ്പ് തുറക്കാൻ എളുപ്പമാകും</span>
      </div>
      <div className="pwa-install-actions">
        <button type="button" className="pwa-install-dismiss" onClick={dismiss}>
          പിന്നീട്
        </button>
        <button type="button" className="pwa-install-btn" onClick={install}>
          Install
        </button>
      </div>
    </div>
  );
}
