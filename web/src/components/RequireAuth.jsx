import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { fetchProfile } from "../api.js";

export default function RequireAuth({ profile = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <main className="auth-shell" aria-live="polite">Loading your account…</main>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (profile) return <ProfileGate />;
  return <Outlet />;
}

function ProfileGate() {
  const { user } = useAuth();
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState({ userId: "", status: "loading", message: "" });
  useEffect(() => {
    let alive = true;
    fetchProfile().then(({ profile }) => {
      if (alive) setResult({ userId: user.id, status: profile.name && profile.machineBrand && profile.machineModel ? "complete" : "incomplete", message: "" });
    }).catch((error) => {
      if (alive) setResult({ userId: user.id, status: "error", message: error instanceof Error ? error.message : "Could not load your profile." });
    });
    return () => { alive = false; };
  }, [user.id, retry]);
  const state = result.userId === user.id ? result.status : "loading";
  if (state === "loading") return <main className="auth-shell" aria-live="polite">Loading your profile…</main>;
  if (state === "incomplete") return <Navigate to="/setup" replace />;
  if (state === "error") return <main className="auth-shell"><section className="auth-card"><p className="auth-error" role="alert">{result.message || "Your profile could not be loaded. Check your connection and try again."}</p><button className="auth-submit" type="button" onClick={() => { setResult({ userId: user.id, status: "loading", message: "" }); setRetry((current) => current + 1); }}>Try again</button></section></main>;
  return <Outlet />;
}
