import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import MachineModel from "../components/MachineModel.jsx";

const SPLASH_MS = 2800;

export default function SplashScreen() {
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  function goChat() {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(() => navigate("/chat", { replace: true }), 420);
  }

  useEffect(() => {
    const timer = window.setTimeout(goChat, SPLASH_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div className="splash-progress splash-enter-late" aria-hidden="true">
        <span />
      </div>
      <p className="splash-credit splash-enter-late">Created by Raaz</p>
    </button>
  );
}
