// Advanced upstream configuration dialog — plugin chrome, not part of the
// ported SPA. Opened from the ⌘K palette ("Odin's Throne: Configure
// upstream") or the connect card. Default auth is the Google sign-in (see
// guest.ts); a bot token here switches to the monitor's /bot surface, and the
// URL override points at a local dev monitor.

import { useState, type CSSProperties } from "react";
import { useSyncExternalStore } from "react";
import { host } from "@hermes/plugin-sdk";
import {
  DEFAULT_UPSTREAM_URL,
  getBotToken,
  getUpstreamUrl,
  setUpstreamConfig,
} from "./upstream";
import { requestReload } from "./pluginCtx";

let open = false;
const listeners = new Set<() => void>();

export const settingsUi = {
  open(): void {
    open = true;
    for (const l of listeners) l();
  },
  close(): void {
    open = false;
    for (const l of listeners) l();
  },
};

export function useSettingsOpen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => open,
    () => open,
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "0.5rem 0.65rem",
  borderRadius: 6,
  border: "1px solid var(--rune-border)",
  background: "var(--void)",
  color: "var(--text-saga)",
  fontFamily: "JetBrains Mono, monospace",
  fontSize: "0.78rem",
};

export function ThroneSettings() {
  const [url, setUrl] = useState(getUpstreamUrl());
  const [token, setToken] = useState(getBotToken());
  const [saving, setSaving] = useState(false);

  async function save(): Promise<void> {
    setSaving(true);
    setUpstreamConfig(url, token);
    const reloaded = await requestReload();
    if (!reloaded) {
      host.notify({
        kind: "info",
        message:
          "Upstream saved — run ⌘K → Reload desktop plugins to reconnect.",
      });
    }
    settingsUi.close();
    setSaving(false);
  }

  return (
    <div
      className="apm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Configure Odin's Throne upstream"
      onClick={(e) => {
        if (e.target === e.currentTarget) settingsUi.close();
      }}
    >
      <div className="throne-settings" style={{ maxWidth: 440 }}>
        <h2>Bind the Bifröst</h2>
        <p className="throne-settings-hint">
          Default auth is the <strong>Google sign-in</strong> (the same login
          the web version uses — press “Sign in with Google” on the pane).
          These are the fallbacks: a bot token switches to the monitor's
          <code>/bot</code> surface, and the URL override points at a local dev
          monitor.
        </p>
        <label>
          Upstream URL
          <input
            style={inputStyle}
            value={url}
            placeholder={DEFAULT_UPSTREAM_URL}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <label>
          Bot token (optional for local dev)
          <input
            style={inputStyle}
            type="password"
            value={token}
            placeholder="paste ODINS_THRONE_BOT_TOKEN"
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
        <div className="throne-settings-row">
          <button className="throne-settings-btn" onClick={() => settingsUi.close()}>
            Cancel
          </button>
          <button
            className="throne-settings-btn primary"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Binding…" : "Save & reconnect"}
          </button>
        </div>
      </div>
    </div>
  );
}
