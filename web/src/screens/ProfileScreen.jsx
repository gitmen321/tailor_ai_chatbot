import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import ScreenHeader from "../components/ScreenHeader.jsx";
import { fetchProfile, saveProfile } from "../api.js";
import { supabase } from "../lib/supabase.js";

export default function ProfileScreen() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ name: "", machineBrand: "", machineModel: "" });
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchProfile().then(({ profile: current }) => {
      if (alive) setProfile({ name: current.name ?? "", machineBrand: current.machineBrand ?? "", machineModel: current.machineModel ?? "" });
    }).catch((loadError) => {
      if (alive) setError(loadError instanceof Error ? loadError.message : "Could not load profile.");
    }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, []);

  function update(field) {
    return (event) => {
      setProfile((current) => ({ ...current, [field]: event.target.value }));
      setSaved(false);
    };
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const result = await saveProfile(profile);
      setProfile(result.profile);
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell sub-screen screen-slide-in">
      <ScreenHeader
        title="Profile"
        subtitle="പ്രൊഫൈൽ"
        backTo="/chat"
      />

      <div className="sub-scroll">
        <div className="profile-card">
          <div className="profile-avatar" aria-hidden="true">
            {profile.name.trim().charAt(0).toUpperCase() || "•"}
          </div>
          <h2 className="profile-name">{profile.name || (busy ? "Loading…" : "Your profile")}</h2>
          <p className="profile-role">
            <Icon name="sparkle" size={13} />
            Tailoring assistant member
          </p>
        </div>

        <section className="settings-group">
          <h2 className="settings-group-title">
            <Icon name="sparkle" size={13} />
            Your details
          </h2>
          <form className="settings-card profile-form" onSubmit={submit}>
            <label htmlFor="profile-name">Your name</label>
            <input id="profile-name" className="text-input" required maxLength={100} value={profile.name} onChange={update("name")} disabled={busy} />
            <label htmlFor="profile-machine-brand">Machine brand</label>
            <input id="profile-machine-brand" className="text-input" required maxLength={80} value={profile.machineBrand} onChange={update("machineBrand")} disabled={busy} />
            <label htmlFor="profile-machine-model">Machine model</label>
            <input id="profile-machine-model" className="text-input" required maxLength={120} value={profile.machineModel} onChange={update("machineModel")} disabled={busy} />
            {error ? <p className="auth-error" role="alert">{error}</p> : null}
            {saved ? <p className="auth-success" role="status">Profile saved.</p> : null}
            <button className="auth-submit" type="submit" disabled={busy || saving}>{saving ? "Saving…" : "Save changes"}</button>
          </form>
        </section>

        <section className="settings-group">
          <h2 className="settings-group-title">
            <Icon name="sparkle" size={13} />
            App
          </h2>
          <div className="settings-card">
            <p>Tailor Assistant</p>
            <p className="muted">Created by Raaz</p>
          </div>
        </section>
        <button className="auth-signout" type="button" onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
}
