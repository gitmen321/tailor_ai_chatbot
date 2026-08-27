import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "tailor_theme_preference";

const ThemeContext = createContext(null);

function getSystemTheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" || saved === "system"
      ? saved
      : "system";
  });
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemTheme(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved = preference === "system" ? systemTheme : preference;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", resolved === "dark" ? "#100E0D" : "#F1ECE4");
    }
  }, [resolved]);

  const value = useMemo(
    () => ({
      preference,
      resolved,
      setPreference: (next) => {
        setPreference(next);
        localStorage.setItem(STORAGE_KEY, next);
      },
    }),
    [preference, resolved]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
