import { useSyncExternalStore } from "react";
import { getPlatform } from "../platform";

export type Theme = "light" | "dark";

const STORAGE_KEY = "fenrir-odins-throne-theme";

// Theme state is shared; WHERE the attribute lands is the platform's call
// (seam 1): the web target sets data-theme on <html>, the plugin scopes the
// Norse palette to its own .odins-throne-root surfaces (rendered from this
// module's state, so its adapter is a no-op and the app theme is untouched).

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
  getPlatform().applyTheme(t);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** The active theme outside React (targets apply it once at startup). */
export function currentTheme(): Theme {
  return current;
}

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const theme = useSyncExternalStore(subscribe, () => current, () => current);
  return { theme, setTheme };
}
