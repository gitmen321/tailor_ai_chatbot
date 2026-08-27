import { useState } from "react";
import { Link } from "react-router-dom";
import ScreenHeader from "../components/ScreenHeader.jsx";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { useVoiceSettings } from "../contexts/VoiceSettingsContext.jsx";
import {
  WALLPAPERS,
  useWallpaper,
} from "../contexts/WallpaperContext.jsx";

const APP_VERSION = "0.2.0";

export default function SettingsScreen() {
  const { preference, setPreference } = useTheme();
  const {
    readAloud,
    setReadAloud,
    ttsSupported,
    isSpeaking,
    isLoadingSpeech,
    speakReply,
    speakText,
    stopSpeaking,
  } = useVoiceSettings();
  const {
    wallpaperId,
    customWallpaper,
    wallpaperClass,
    wallpaperStyle,
    setWallpaperId,
    setCustomWallpaperFromFile,
    clearCustomWallpaper,
  } = useWallpaper();
  const [wallpaperError, setWallpaperError] = useState(null);

  async function onPickWallpaper(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setWallpaperError(null);
    try {
      await setCustomWallpaperFromFile(file);
    } catch (err) {
      setWallpaperError(
        err?.message || "വാൾപേപ്പർ സേവ് ചെയ്യാൻ കഴിഞ്ഞില്ല."
      );
    }
  }

  return (
    <div className="app-shell sub-screen screen-slide-in">
      <ScreenHeader
        title="Settings"
        subtitle="ക്രമീകരണങ്ങൾ"
        backTo="/chat"
      />

      <div className="sub-scroll">
        <section className="settings-group">
          <h2 className="settings-group-title">Appearance</h2>
          <div className="settings-card">
            <p className="settings-row-label">Theme</p>
            <div className="segmented" role="group" aria-label="Theme">
              {[
                { id: "light", label: "Light" },
                { id: "dark", label: "Dark" },
                { id: "system", label: "System" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`segmented-btn ${
                    preference === opt.id ? "is-active" : ""
                  }`}
                  onClick={() => setPreference(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="settings-group">
          <h2 className="settings-group-title">Chat wallpaper</h2>
          <div className="settings-card">
            <div
              className={`wallpaper-live ${wallpaperClass}`}
              style={wallpaperStyle}
            >
              <div className="wallpaper-live-bubble">ഹലോ റസിയ</div>
            </div>
            <div className="wallpaper-grid">
              {WALLPAPERS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className={`wallpaper-swatch wallpaper-${w.id} ${
                    wallpaperId === w.id ? "is-active" : ""
                  }`}
                  onClick={() => setWallpaperId(w.id)}
                  aria-label={w.label}
                >
                  <span>{w.labelMl}</span>
                </button>
              ))}
              {customWallpaper ? (
                <button
                  type="button"
                  className={`wallpaper-swatch wallpaper-swatch-custom ${
                    wallpaperId === "custom" ? "is-active" : ""
                  }`}
                  style={{ backgroundImage: `url(${customWallpaper})` }}
                  onClick={() => setWallpaperId("custom")}
                  aria-label="Custom wallpaper"
                >
                  <span>സ്വന്തം</span>
                </button>
              ) : null}
            </div>
            <div className="wallpaper-upload-row">
              <label className="wallpaper-upload-btn">
                <input
                  type="file"
                  accept="image/*"
                  onChange={onPickWallpaper}
                />
                📷 സ്വന്തം ഫോട്ടോ
              </label>
              {customWallpaper ? (
                <button
                  type="button"
                  className="wallpaper-clear-btn"
                  onClick={clearCustomWallpaper}
                >
                  Remove photo
                </button>
              ) : null}
            </div>
            {wallpaperError ? (
              <p className="settings-error" role="alert">
                {wallpaperError}
              </p>
            ) : null}
          </div>
        </section>

        <section className="settings-group">
          <h2 className="settings-group-title">Voice</h2>
          <div className="settings-card">
            <div className="settings-toggle-row">
              <div>
                <p className="settings-row-label settings-row-label-inline">
                  Read replies aloud
                </p>
                <p className="settings-hint">മറുപടി ഉറക്കെ വായിക്കുക</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={readAloud}
                aria-label="Read replies aloud"
                className={`toggle-switch ${readAloud ? "is-on" : ""}`}
                disabled={!ttsSupported}
                onClick={() => setReadAloud(!readAloud)}
              >
                <span className="toggle-knob" />
              </button>
            </div>
            {ttsSupported ? (
              <p className="settings-note settings-note-ok" role="status">
                മലയാളം വായന സെർവർ വഴി — PC, ഫോൺ എല്ലായിടത്തും പ്രവർത്തിക്കും.
              </p>
            ) : null}
          </div>
        </section>

        <section className="settings-group">
          <h2 className="settings-group-title">Account</h2>
          <div className="settings-card settings-list">
            <Link to="/profile" className="settings-link-row">
              <span>Profile</span>
              <span className="chevron">›</span>
            </Link>
          </div>
        </section>

        <section className="settings-group">
          <h2 className="settings-group-title">About</h2>
          <div className="settings-card about-card">
            <p className="about-mark" aria-hidden="true">
              🪡
            </p>
            <p>Version {APP_VERSION}</p>
            <p className="muted">Created by Raaz</p>
          </div>
        </section>
      </div>
    </div>
  );
}
