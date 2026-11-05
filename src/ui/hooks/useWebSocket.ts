import { useEffect, useRef, useCallback, useState } from "react";
import type { ServerMessage, ClientMessage } from "../lib/types";
import { getPlatform } from "../platform";

type WsState = "connecting" | "open" | "closed" | "error";

const MAX_RECONNECT = 10;
const BASE_DELAY_MS = 1000;

export function useWebSocket(onMessage: (msg: ServerMessage) => void, namespace = "fenrir-agents") {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  // Track the namespace the current WS connection was opened with
  const connectedNamespaceRef = useRef<string | null>(null);
  // Guard: cleared in cleanup so the async close event cannot re-arm the timer
  const shouldReconnect = useRef(true);

  const [state, setState] = useState<WsState>("connecting");
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback((ns: string) => {
    // If already connected to the right namespace, skip
    if (
      connectedNamespaceRef.current === ns &&
      (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING)
    ) return;

    // Close existing connection when switching namespaces.
    // Clear shouldReconnect first so the async close event from the old socket
    // cannot fire scheduleReconnect, then immediately re-enable it for the new
    // socket we are about to open.
    if (wsRef.current) {
      shouldReconnect.current = false;
      wsRef.current.close();
      wsRef.current = null;
      connectedNamespaceRef.current = null;
      shouldReconnect.current = true;
    }

    // Seam 2: the platform adapter decides which socket the stream dials
    // (same-origin /ws on the web, the monitor's token-gated bot surface in
    // the plugin); the protocol, reconnect and backoff logic are shared.
    const ws = new WebSocket(getPlatform().wsUrl(ns));
    wsRef.current = ws;
    connectedNamespaceRef.current = ns;
    setState("connecting");

    ws.addEventListener("open", () => {
      setError(null);
      reconnectCount.current = 0;
      setState("open");
    });

    ws.addEventListener("message", (ev) => {
      try {
        const msg = JSON.parse(ev.data) as ServerMessage;
        onMessageRef.current(msg);
      } catch { /* ignore */ }
    });

    ws.addEventListener("close", () => {
      // Identity guard: ignore events from a socket that has already been
      // replaced (namespace switch) or torn down (unmount).
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      connectedNamespaceRef.current = null;
      setState("closed");
      scheduleReconnect();
    });

    ws.addEventListener("error", () => {
      setState("error");
      setError("WebSocket connection lost — reconnecting…");
    });
  }, []);

  // Keep a stable ref to the current namespace so scheduleReconnect can use it
  const namespaceRef = useRef(namespace);
  namespaceRef.current = namespace;

  const scheduleReconnect = useCallback(() => {
    // Do not reconnect after teardown (unmount or namespace-switch cleanup).
    if (!shouldReconnect.current) return;
    if (reconnectCount.current >= MAX_RECONNECT) {
      setError(`WebSocket failed after ${MAX_RECONNECT} attempts. Reload to retry.`);
      return;
    }
    const delay = Math.min(BASE_DELAY_MS * 2 ** reconnectCount.current, 30000);
    reconnectCount.current++;
    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null;
      connect(namespaceRef.current);
    }, delay);
  }, [connect]);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Connect on mount and reconnect when namespace changes
  useEffect(() => {
    reconnectCount.current = 0;
    shouldReconnect.current = true;
    connect(namespace);
    return () => {
      // Disable reconnects BEFORE closing so the async close event cannot
      // re-arm the timer after cleanup completes.
      shouldReconnect.current = false;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        connectedNamespaceRef.current = null;
      }
    };
  }, [connect, namespace]);

  return { state, error, send };
}
