import { useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
import { useAuth } from "../contexts/AuthContext.jsx";

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

function readableAuthError(error, mode) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }
  if (message.includes("captcha") || message.includes("security")) {
    return "The security check expired. Please complete it again.";
  }
  if (message.includes("password") && message.includes("least")) {
    return "Choose a longer password.";
  }
  if (mode === "signup" && message.includes("already registered")) {
    return "An account may already exist for this email. Try signing in.";
  }
  return mode === "signup"
    ? "Could not create the account. Check the details and try again."
    : "Could not sign in. Check the details and try again.";
}

export default function AuthScreen() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!authLoading && user) return <Navigate to="/chat" replace />;

  function changeMode(nextMode) {
    setMode(nextMode);
    setCaptchaToken("");
    setCaptchaKey((key) => key + 1);
    setMessage("");
    setError("");
  }

  async function submitCredentials(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!isSupabaseConfigured) {
        throw new Error("Supabase Auth is not configured for this build.");
      }
      if (turnstileSiteKey && !captchaToken) {
        throw new Error("Complete the security check first.");
      }

      const credentials = {
        email: email.trim(),
        password,
        ...(captchaToken ? { options: { captchaToken } } : {}),
      };
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp(credentials);
        if (authError) throw authError;
        if (data.session) {
          navigate("/setup", { replace: true });
        } else {
          setMessage(
            "Account created, but email confirmation is still enabled. Turn off Confirm email in Supabase Auth for this demo.",
          );
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword(
          credentials,
        );
        if (authError) throw authError;
        navigate("/chat", { replace: true });
      }
    } catch (authError) {
      setError(readableAuthError(authError, mode));
    } finally {
      setBusy(false);
      setCaptchaToken("");
      setCaptchaKey((key) => key + 1);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!isSupabaseConfigured) {
        throw new Error("Supabase Auth is not configured for this build.");
      }
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/chat` },
      });
      if (authError) throw authError;
    } catch {
      setError(
        "Google sign-in is unavailable. Check that the Google provider is enabled in Supabase Auth.",
      );
      setBusy(false);
    }
  }

  const captchaRequired = Boolean(turnstileSiteKey);

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="auth-kicker">Tailor Assistant</p>
        <h1 id="auth-title">Your machine, your assistant</h1>
        <p className="auth-copy">
          Create an account to save your profile, machine details, and private
          chat history.
        </p>

        <div className="auth-mode-tabs" aria-label="Account access">
          <button
            type="button"
            className={mode === "signin" ? "active" : ""}
            aria-pressed={mode === "signin"}
            onClick={() => changeMode("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === "signup" ? "active" : ""}
            aria-pressed={mode === "signup"}
            onClick={() => changeMode("signup")}
          >
            Create account
          </button>
        </div>

        <form onSubmit={submitCredentials}>
          <label className="auth-label" htmlFor="auth-email">
            Email address
          </label>
          <input
            id="auth-email"
            className="text-input auth-input"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label className="auth-label" htmlFor="auth-password">
            Password
          </label>
          <input
            id="auth-password"
            className="text-input auth-input"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={mode === "signup" ? 8 : undefined}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {turnstileSiteKey ? (
            <Turnstile
              key={captchaKey}
              siteKey={turnstileSiteKey}
              onSuccess={setCaptchaToken}
              onExpire={() => setCaptchaToken("")}
              onError={() => setCaptchaToken("")}
            />
          ) : null}
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          {message
            ? <p className="auth-success" role="status">{message}</p>
            : null}
          <button
            className="auth-submit"
            type="submit"
            disabled={!isSupabaseConfigured || busy || (captchaRequired && !captchaToken)}
          >
            {busy
              ? "Please wait…"
              : mode === "signup"
              ? "Create account"
              : "Sign in"}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>
        <button
          className="auth-google"
          type="button"
          onClick={signInWithGoogle}
          disabled={!isSupabaseConfigured || busy}
        >
          <GoogleIcon />
          Continue with Google
        </button>
        <p className="auth-demo-note">
          Demo accounts are not email-verified. Use a unique password. Password
          recovery by email will be available after email delivery is configured.
          Google sign-in may be limited to invited testers.
        </p>
        <Link className="auth-back" to="/">Back to welcome</Link>
      </section>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" width="20" height="20">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(1 1) scale(.96)" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.73 7.18l7.65 5.93c4.47-4.13 7.12-10.2 7.12-17.58Z" transform="translate(1 1) scale(.96)" />
      <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.92 23.92 0 0 0 0 24c0 3.88.93 7.56 2.56 10.78l7.97-6.19Z" transform="translate(1 1) scale(.96)" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.87l-7.65-5.93c-2.13 1.43-4.85 2.27-8.25 2.27-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" transform="translate(1 1) scale(.96)" />
    </svg>
  );
}
