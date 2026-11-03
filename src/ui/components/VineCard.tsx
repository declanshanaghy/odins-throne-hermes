// Vine-strand job card (issue #12, garden pattern wave 2) — the full job
// card that hangs along the open world's curved vine in the namespace tree.
//
// Everything shows ON the card — no popups anywhere (the approved prototype
// design/tree-display/tree-display-prototype.html, `.jcard` + `.jact`):
//
//   ⚒  Issue #12 · port the ballad pages        ← title + status dot
//      s-run-1 · Issue #12 · FiremanDecko       ← session · issue # · agent
//      [focus] [unpin] [cancel]                 ← on-card actions
//
// The status sigil follows the taskIcon contract (namespaceIcons.ts):
// hammer while running, dice while pending, raven for failure, ring when
// succeeded — remote <img> with an inline-glyph fallback offline (TreeIcon).
//
// Actions, all local to the card:
//   • open/focus — the card body click opens the session's tab; a session
//     whose tab is already open reads "focus" and never stacks a duplicate.
//   • pin/unpin  — toggles right on the card (is-on styling when pinned).
//   • cancel     — Ragnarök; rendered ONLY while the job is cancellable
//     (running or pending). The tremble→fall→purge choreography lives in
//     the tree (NamespaceTree renders the falling ghost once the pod is
//     purged); the tab closes with the pod.
//
// The card is absolutely positioned by the tree at its vine anchor — it
// never computes its own geometry (lib/vineGeometry.ts owns that).

import type { CSSProperties } from "react";
import type { DisplayJob } from "../lib/types";
import { taskIcon, taskIconFallback } from "../lib/namespaceIcons";
import { resolveSessionTitle } from "../lib/resolveSessionTitle";
import { STATUS_LABELS } from "../lib/constants";
import { TreeIcon } from "./TreeIcon";

interface Props {
  job: DisplayJob;
  /** The session's tab is the active one — teal ring + selected semantics. */
  isActive: boolean;
  isPinned: boolean;
  /** Terminating (cancel confirmed) — the tremble plays until the purge. */
  isTerminating: boolean;
  /** Which side of the vine anchor the card hangs from (stem direction). */
  side: "right" | "left";
  /** Absolute position on the canvas — computed by the tree's geometry. */
  style?: CSSProperties;
  /**
   * Falling ghost: the pod was purged out from under the card. The card
   * plays the fall animation, ignores pointer events, and is swept by the
   * tree after the animation ends.
   */
  ghost?: boolean;
  /** Card body click — open (or focus) the session's workspace tab. */
  onOpen: () => void;
  /** Pin toggle — right on the card. */
  onTogglePin: () => void;
  /** Cancel (Ragnarök) — only rendered while the job is cancellable. */
  onCancel: () => void;
}

/** A job can be cancelled while its pod still lives: running or pending. */
export function isCancellable(status: DisplayJob["status"]): boolean {
  return status === "running" || status === "pending";
}

export function VineCard({
  job,
  isActive,
  isPinned,
  isTerminating,
  side,
  style,
  ghost = false,
  onOpen,
  onTogglePin,
  onCancel,
}: Props) {
  const sLabel = STATUS_LABELS[job.status] || job.status;
  const title = resolveSessionTitle(job);
  const cancellable = isCancellable(job.status);
  const cls = [
    "jcard",
    `jcard--${job.status}`,
    isActive ? "is-active" : "",
    isTerminating ? "jcard--terminating" : "",
    // pop-in plays ON MOUNT only — live WS updates re-render the same
    // keyed element, so the sprout never replays on a status change.
    ghost ? "" : "pop-in",
    ghost ? "fall-out" : "",
    ghost ? "is-dim" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // The card BODY is the treeitem — keyboard-operable like every lantern
  // button: Tab reaches it, Enter/Space opens the session's tab (the same
  // path a click takes). Falling ghosts ignore keys with the pointer.
  const openOnKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (ghost) return;
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <div
      className={cls}
      role="treeitem"
      tabIndex={ghost ? undefined : 0}
      aria-selected={isActive}
      aria-label={`${job.sessionId} — ${title} — ${sLabel}`}
      title={title}
      data-session={job.sessionId}
      data-side={side}
      data-status={job.status}
      style={style}
      onClick={ghost ? undefined : onOpen}
      onKeyDown={openOnKey}
    >
      <span className="jcard__sigil" aria-hidden="true">
        <TreeIcon src={taskIcon(job.status)} fallback={taskIconFallback(job.status)} size="task" />
      </span>
      <div className="jcard__main">
        <div className="jcard__row1">
          <span className="jcard__title" title={title}>
            {title}
          </span>
          <i className="jcard__dot" aria-hidden="true" />
        </div>
        <div className="jcard__row2">
          <span className="jcard__meta">
            <b>{job.sessionId}</b>
            {" · Issue #"}
            {job.issue}
            {" · "}
            {job.agentName}
            {isPinned ? " · 📌" : ""}
          </span>
          <span className="jcard__acts">
            <button
              type="button"
              className={`jact jact--pin${isPinned ? " is-on" : ""}`}
              data-act="pin"
              title={isPinned ? "unpin session" : "pin session"}
              aria-label={isPinned ? `Unpin session ${job.sessionId}` : `Pin session ${job.sessionId}`}
              aria-pressed={isPinned}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
            >
              📌
            </button>
            {cancellable && (
              <button
                type="button"
                className="jact jact--cancel"
                data-act="cancel"
                title="cancel job"
                aria-label={`Cancel job ${job.sessionId}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
              >
                ✕
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}