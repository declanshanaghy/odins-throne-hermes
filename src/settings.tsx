// Advanced upstream configuration dialog — plugin chrome, not part of the
// ported SPA. Opened from the ⌘K palette ("Odin's Throne: Configure
// upstream") or the connect card. Auth is Google OAuth only (see guest.ts) —
// no session means no data; the sole setting is the upstream URL, overridden
// for local dev servers (which run without oauth2-proxy).

import { useState, type CSSProperties } from "react";
import { useSyncExternalStore } from "react";
import { host } from "@hermes/plugin-sdk";
import {
  DEFAULT_UPSTREAM_URL,
  getUpstreamUrl,
  setUpstreamConfig,
} from "./upstream";
import {
  guestStatus,
  reauth,
  subscribeGuestStatus,
} from "./guest";
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
  const [saving, setSaving] = useState(false);
  const status = useSyncExternalStore(subscribeGuestStatus, guestStatus, guestStatus);

  async function save(): Promise<void> {
    setSaving(true);
    setUpstreamConfig(url);
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
          <strong>Google OAuth is the only way in</strong> — the same login the
          web version uses; no session, no data. The only setting is the
          upstream URL, overridden for a local dev monitor (which runs without
          oauth2-proxy).
        </p>
        <p className="throne-settings-hint">
          Session: <strong>{status === "authed" ? "signed in ✓" : status}</strong>
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
        <div className="throne-settings-row">
          <button className="throne-settings-btn" onClick={() => settingsUi.close()}>
            Cancel
          </button>
          {status !== "authed" && (
            <button className="throne-settings-btn" onClick={() => reauth()}>
              Sign in with Google
            </button>
          )}
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
