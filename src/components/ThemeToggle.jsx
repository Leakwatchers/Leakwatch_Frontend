import { useTheme } from "../hooks/useTheme";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isLight = theme === "light";

  return (
    <button className="theme-toggle" onClick={toggle} title="Alternar tema">
      <span className="toggle-icon">{isLight ? "☀️" : "🌙"}</span>
      <span>{isLight ? "Tema claro" : "Tema escuro"}</span>
      <span className="toggle-track" />
    </button>
  );
}
