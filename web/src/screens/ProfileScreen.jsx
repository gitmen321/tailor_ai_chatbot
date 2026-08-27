import Icon from "../components/Icon.jsx";
import ScreenHeader from "../components/ScreenHeader.jsx";

const MACHINE_BRAND =
  import.meta.env.VITE_MACHINE_BRAND || "Usha";
const MACHINE_MODEL =
  import.meta.env.VITE_MACHINE_MODEL || "Quick Stitch Master";

export default function ProfileScreen() {
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
            റ
          </div>
          <h2 className="profile-name">Rasiya</h2>
          <p className="profile-name-ml">റസിയ</p>
          <p className="profile-role">
            <Icon name="sparkle" size={13} />
            Tailoring assistant member
          </p>
        </div>

        <section className="settings-group">
          <h2 className="settings-group-title">
            <Icon name="machine" size={13} />
            Machine
          </h2>
          <div className="settings-card profile-machine">
            <div className="profile-machine-icon" aria-hidden="true">
              <Icon name="machine" size={24} />
            </div>
            <div>
              <p className="profile-machine-title">
                {MACHINE_BRAND} {MACHINE_MODEL}
              </p>
              <p className="muted">
                യൂഷ ക്വിക്ക് സ്റ്റിച്ച് മാസ്റ്റർ · straight stitch industrial
              </p>
            </div>
          </div>
        </section>

        <section className="settings-group">
          <h2 className="settings-group-title">
            <Icon name="sparkle" size={13} />
            App
          </h2>
          <div className="settings-card">
            <p>Tailor Assistant — WhatsApp backup channel</p>
            <p className="muted">Created by Raaz</p>
          </div>
        </section>
      </div>
    </div>
  );
}
