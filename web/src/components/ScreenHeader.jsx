import { useNavigate } from "react-router-dom";
import Icon from "./Icon.jsx";

export default function ScreenHeader({ title, subtitle, backTo = "/chat" }) {
  const navigate = useNavigate();

  return (
    <header className="screen-header">
      <button
        type="button"
        className="icon-btn back-btn"
        onClick={() => navigate(backTo)}
        aria-label="Back"
      >
        <Icon name="arrow-left" />
      </button>
      <div className="screen-header-text">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </header>
  );
}
