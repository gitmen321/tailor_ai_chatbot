import { useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { Link, Navigate } from "react-router-dom";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
import { useAuth } from "../contexts/AuthContext.jsx";

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export default function AuthScreen() {
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!authLoading && user) return <Navigate to="/chat" replace />;

  async function sendMagicLink(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!isSupabaseConfigured) throw new Error("Supabase Auth is not configured for this build.");
      if (turnstileSiteKey && !captchaToken) throw new Error("Complete the security check first.");
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/chat`,
          ...(captchaToken ? { captchaToken } : {}),
        },
      });
      if (authError) throw authError;
      setMessage("Check your email for a secure sign-in link. New users can create their account with the same link.");
      setCaptchaToken("");
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Could not send the sign-in email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="auth-kicker">Tailor Assistant</p>
        <h1 id="auth-title">Sign in or create an account</h1>
        <p className="auth-copy">Use your email to receive a private sign-in link. Your profile and machine details will be saved to your account.</p>
        <form onSubmit={sendMagicLink}>
          <label className="auth-label" htmlFor="auth-email">Email address</label>
          <input id="auth-email" className="text-input auth-input" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
          {turnstileSiteKey ? (
            <Turnstile siteKey={turnstileSiteKey} onSuccess={setCaptchaToken} onExpire={() => setCaptchaToken("")} onError={() => setCaptchaToken("")} />
          ) : null}
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          {message ? <p className="auth-success" role="status">{message}</p> : null}
          <button className="auth-submit" type="submit" disabled={!isSupabaseConfigured || busy || (Boolean(turnstileSiteKey) && !captchaToken)}>
            {busy ? "Sending link…" : "Email me a sign-in link"}
          </button>
        </form>
        <Link className="auth-back" to="/">Back to welcome</Link>
      </section>
    </main>
  );
}
