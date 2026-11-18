import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProfile, saveProfile } from "../api.js";

export default function ProfileSetupScreen() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", machineBrand: "", machineModel: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchProfile().then(({ profile }) => {
      if (alive) setForm({ name: profile.name ?? "", machineBrand: profile.machineBrand ?? "", machineModel: profile.machineModel ?? "" });
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  function update(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await saveProfile(form);
      navigate("/chat", { replace: true });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="profile-setup-title">
        <p className="auth-kicker">Personal setup</p>
        <h1 id="profile-setup-title">Tell us about your machine</h1>
        <p className="auth-copy">The assistant uses these details in your chats. You can edit them later in Profile.</p>
        <form onSubmit={submit}>
          <label className="auth-label" htmlFor="profile-name">Your name</label>
          <input id="profile-name" className="text-input auth-input" autoComplete="name" required maxLength={100} value={form.name} onChange={update("name")} />
          <label className="auth-label" htmlFor="machine-brand">Machine brand</label>
          <input id="machine-brand" className="text-input auth-input" required maxLength={80} placeholder="For example, Usha" value={form.machineBrand} onChange={update("machineBrand")} />
          <label className="auth-label" htmlFor="machine-model">Machine model</label>
          <input id="machine-model" className="text-input auth-input" required maxLength={120} placeholder="Enter the model printed on your machine" value={form.machineModel} onChange={update("machineModel")} />
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Saving…" : "Save and continue"}</button>
        </form>
      </section>
    </main>
  );
}
