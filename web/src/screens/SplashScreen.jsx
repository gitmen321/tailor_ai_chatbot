import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProgress } from "@react-three/drei";
import Icon from "../components/Icon.jsx";
import MachineModel from "../components/MachineModel.jsx";

/** Hold the splash at least this long so the model gets a proper look. */
const MIN_SPLASH_MS = 5000;
/** Never block on a slow/failed model download beyond this. */
const MAX_SPLASH_MS = 9000;

export default function SplashScreen() {
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const { progress, active } = useProgress();
  const leavingRef = useRef(false);

  const [minElapsed, setMinElapsed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // `active` is false before the loader starts, so only treat "not active" as
  // done once some progress has actually been reported.
  const modelReady = progress >= 100 && !active;

  const goChat = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    window.setTimeout(() => navigate("/chat", { replace: true }), 420);
  }, [navigate]);

  useEffect(() => {
    const minTimer = window.setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS);
    const maxTimer = window.setTimeout(() => setTimedOut(true), MAX_SPLASH_MS);
    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(maxTimer);
    };
  }, []);

  useEffect(() => {
    if (timedOut || (minElapsed && modelReady)) {
      goChat();
    }
  }, [timedOut, minElapsed, modelReady, goChat]);

  const pct = Math.min(100, Math.round(progress));

  return (
    <button
      type="button"
      className={`splash-screen ${leaving ? "is-leaving" : ""}`}
      onClick={goChat}
      aria-label="Continue to chat"
    >
      <div className="splash-glow" aria-hidden="true" />

      <div className="splash-model splash-enter">
        <MachineModel size="lg" spinning />
      </div>

      <div className="splash-copy splash-enter-delay">
        <p className="splash-kicker">
          <Icon name="sparkle" size={13} />
          Tailor Assistant
        </p>
        <h1 className="splash-title">
          Welcome <em>Rasiya</em>,
          <br />
          I&apos;m here to help you
        </h1>
        <p className="splash-ml">സഹായത്തിനായി ഞാൻ ഇവിടെയുണ്ട്</p>
      </div>

      <div
        className="splash-loader splash-enter-late"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Loading"
      >
        <div className="splash-progress">
          <span style={{ width: `${Math.max(pct, 6)}%` }} />
        </div>
        <p className="splash-loader-label">
          {modelReady ? "തയ്യാർ" : "ലോഡ് ചെയ്യുന്നു…"}
        </p>
      </div>

      <p className="splash-credit">Created by Raaz</p>
    </button>
  );
}
