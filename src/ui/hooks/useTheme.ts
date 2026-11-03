import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "fenrir-odins-throne-theme";

// Desktop port: the browser SPA set data-theme on <html>. The plugin scopes
// the Norse palette to its own surfaces — the attribute lives on each
// .odins-throne-root element (rendered from this module's state), so the app
// theme is never touched.

let current: Theme = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
})();

const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function setTheme(t: Theme): void {
  current = t;
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch {
    // localStorage unavailable — apply anyway
  }
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const theme = useSyncExternalStore(subscribe, () => current, () => current);
  return { theme, setTheme };
}
