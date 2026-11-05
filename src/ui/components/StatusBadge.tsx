import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useTheme } from "../hooks/useTheme";

interface Props {
  state: "connecting" | "open" | "closed" | "error";
}

/** Viewport clamp padding (issue #101 — popups stay inside the visible
 * bounds with padding, whatever pane/scroll container hosts the badge). */
const VIEWPORT_PAD = 8;
/** Gap between the badge and the tooltip, below or above. */
const BADGE_GAP = 6;
/** Maximum practical CSS z-index (2147483647 is the 32-bit ceiling) — the
 * tooltip rides above every pane, panel and app chrome layer. */
const POPUP_Z = 2147483000;

const STATE_COLORS: Record<Props["state"], string> = {
  open: "#22c55e",
  connecting: "#eab308",
  closed: "#6b7280",
  error: "#ef4444",
};

const WOLF_VOICE: Record<Props["state"], string> = {
  open: "The thread holds. Fenrir watches.",
  connecting: "The Norns weave. Hold fast.",
  closed: "The chain is broken. Fenrir stirs.",
  error: "The chain is broken. Fenrir stirs.",
};

const ARIA_LABEL: Record<Props["state"], string> = {
  open: "WebSocket connected — the thread holds",
  connecting: "WebSocket reconnecting — the Norns weave",
  closed: "WebSocket closed — the chain is broken",
  error: "WebSocket error — the chain is broken",
};

/** role per state: status for ok/in-progress, alert for broken */
function roleForState(state: Props["state"]): "status" | "alert" {
  return state === "closed" || state === "error" ? "alert" : "status";
}

/** Plug/connection SVG icon — filled circle with signal arcs, coloured by WS state */
function WssIcon({ color }: { color: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* plug body */}
      <rect x="6" y="8" width="4" height="5" rx="1" fill={color} />
      {/* left pin */}
      <rect x="5" y="6" width="1.5" height="3" rx="0.5" fill={color} />
      {/* right pin */}
      <rect x="9.5" y="6" width="1.5" height="3" rx="0.5" fill={color} />
      {/* plug head */}
      <rect x="4.5" y="3" width="7" height="4" rx="1.5" fill={color} />
      {/* signal arc — outer */}
      <path
        d="M2.5 2.5 C2.5 2.5 1 4.5 1 8 C1 11.5 2.5 13.5 2.5 13.5"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* signal arc — inner */}
      <path
        d="M13.5 2.5 C13.5 2.5 15 4.5 15 8 C15 11.5 13.5 13.5 13.5 13.5"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
    </svg>
  );
}

export function StatusBadge({ state }: Props) {
  const color = STATE_COLORS[state];
  const tooltipId = useId();
  const [visible, setVisible] = useState(false);
  const { theme } = useTheme();
  const badgeRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  /**
   * Manual portal (issue #101). The tooltip is React-rendered inside the
   * badge wrapper, then the node is reparented under a fixed, zero-footprint
   * host appended to document.body. That escapes every clipping ancestor
   * (the pane root's inline overflow:hidden, the sidebar scroller, the
   * collapsed 72px rail) and every pane stacking context — at the document's
   * top layer nothing can sit above it. The host carries the odins-throne-root
   * scope class + data-theme so the build-scoped CSS and palette vars still
   * apply; its inline styles neutralise the scoped html/body rules that would
   * otherwise paint a full-viewport backdrop or size it as a flex column.
   * React keeps patching the node's contents wherever it lives; the cleanup
   * hands the node back to its React parent before unmount so React's
   * removeChild still finds it where it inserted it.
   */
  useLayoutEffect(() => {
    const tip = tooltipRef.current;
    const home = wrapperRef.current;
    if (!tip || !home) return;
    const host = document.createElement("div");
    host.className = "odins-throne-root wss-tooltip-portal";
    if (theme === "light") host.setAttribute("data-theme", "light");
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.height = "auto";
    host.style.overflow = "visible";
    host.style.display = "block";
    host.style.pointerEvents = "none";
    host.style.zIndex = String(POPUP_Z);
    host.style.background = "none";
    document.body.appendChild(host);
    hostRef.current = host;
    host.appendChild(tip);
    return () => {
      if (tip.parentNode === host) home.appendChild(tip);
      host.remove();
      hostRef.current = null;
    };
    // theme read once at host creation; the effect below keeps it in sync
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the portal host's palette in step with theme switches.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (theme === "light") host.setAttribute("data-theme", "light");
    else host.removeAttribute("data-theme");
  }, [theme]);

  /**
   * Viewport-clamped placement (issue #101). The tooltip is position:fixed
   * at the document top layer, so no ancestor overflow (sidebar, dock pane,
   * collapsed rail) can clip it and no pane stacking context can bury it.
   * Preferred spot: below the badge, right-aligned with it; flips above the
   * badge when there is no room below. Final left/top are clamped so the
   * whole box stays inside the padded viewport.
   */
  const place = useCallback(() => {
    const badge = badgeRef.current;
    const tip = tooltipRef.current;
    if (!badge || !tip) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const b = badge.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    let top = b.bottom + BADGE_GAP;
    let above = false;
    if (top + h > vh - VIEWPORT_PAD && b.top - BADGE_GAP - h >= VIEWPORT_PAD) {
      top = b.top - BADGE_GAP - h;
      above = true;
    }
    top = Math.max(VIEWPORT_PAD, Math.min(top, vh - VIEWPORT_PAD - h));
    const left = Math.max(VIEWPORT_PAD, Math.min(b.right - w, vw - VIEWPORT_PAD - w));
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
    tip.classList.toggle("wss-tooltip--above", above);
    // Arrow tracks the badge's centre-x, clamped inside the box so it always
    // points at the badge even when the tooltip itself was clamped sideways.
    const arrowX = Math.max(10, Math.min(b.left + b.width / 2 - left, w - 10));
    tip.style.setProperty("--wss-arrow-x", `${Math.round(arrowX)}px`);
  }, []);

  // Position before first paint of every show, and whenever the text (state
  // changes) or visibility changes size.
  useLayoutEffect(() => {
    place();
  }, [place, visible, state]);

  // While open, follow viewport changes: window resizes and any scroll
  // (capture: the pane and its scrollers never bubble their scroll events).
  useEffect(() => {
    if (!visible) return;
    const onMove = () => place();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [visible, place]);

  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (showTimerRef.current !== null) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    clearTimers();
    setVisible(false);
  }, [clearTimers]);

  // Dismiss tooltip when state changes (e.g. ws reconnects mid-hover)
  useEffect(() => {
    hide();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const handleMouseEnter = useCallback(() => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    showTimerRef.current = setTimeout(() => {
      showTimerRef.current = null;
      show();
    }, 300);
  }, [show]);

  const handleMouseLeave = useCallback(() => {
    if (showTimerRef.current !== null) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      hide();
    }, 100);
  }, [hide]);

  const handleFocus = useCallback(() => {
    clearTimers();
    show();
  }, [clearTimers, show]);

  const handleBlur = useCallback(() => {
    hide();
  }, [hide]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && visible) {
        e.preventDefault();
        hide();
      }
    },
    [visible, hide]
  );

  // Mobile: tap to show for 3s, tap again to dismiss
  const handleClick = useCallback(() => {
    if (visible) {
      if (mobileDismissRef.current !== null) {
        clearTimeout(mobileDismissRef.current);
        mobileDismissRef.current = null;
      }
      setVisible(false);
    } else {
      setVisible(true);
      mobileDismissRef.current = setTimeout(() => {
        mobileDismissRef.current = null;
        setVisible(false);
      }, 3000);
    }
  }, [visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      if (mobileDismissRef.current !== null) {
        clearTimeout(mobileDismissRef.current);
      }
    };
  }, [clearTimers]);

  const role = roleForState(state);
  const ariaLive = role === "alert" ? "assertive" : "polite";

  return (
    <span ref={wrapperRef} className="wss-tooltip-wrapper">
      <span
        ref={badgeRef}
        className={`ws-badge ws-badge-icon ${state}`}
        aria-label={ARIA_LABEL[state]}
        aria-describedby={tooltipId}
        aria-live={ariaLive}
        role={role}
        tabIndex={0}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
      >
        <WssIcon color={color} />
      </span>
      {/* Rendered into the React tree here, then reparented under a
       * document.body host by the layout effect below (issue #101) —
       * the runtime plugin loader allows only react + @hermes/plugin-sdk
       * imports (no react-dom → no createPortal), so the portal is done by
       * hand. React keeps patching the node's contents wherever it lives. */}
      <span
        ref={tooltipRef}
        id={tooltipId}
        role="tooltip"
        className={`wss-tooltip${visible ? " wss-tooltip--visible" : ""}`}
      >
        {WOLF_VOICE[state]}
      </span>
    </span>
  );
}
