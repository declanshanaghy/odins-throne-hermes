import type { Theme } from "../hooks/useTheme";

interface Props {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

// With exactly two themes (Theme = "light" | "dark", useTheme.ts) one toggle
// is enough: a click flips light ↔ dark. The button seats in the sidebar's
// brand header row, immediately left of the status badge; its accessible
// label names the theme a click will switch to, and the glyph mirrors that
// target theme so icon and label always agree.
export function ThemeSwitcher({ theme, setTheme }: Props) {
  const next: Theme = theme === "light" ? "dark" : "light";
  const label = `Switch to ${next} theme`;
  return (
    <button
      type="button"
      className="theme-btn"
      aria-pressed={theme === "dark"}
      aria-label={label}
      title={label}
      onClick={() => setTheme(next)}
    >
      {next === "light" ? "☀" : "☽"}
    </button>
  );
}
