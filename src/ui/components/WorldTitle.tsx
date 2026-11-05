// World title section — v3.13.2 (issue #95).
//
// A glass panel riding on the painting's upper sky (~90% of scene width, above
// the topmost lanterns). Shows the last-seated world's name, stats, garden band
// (opaque stone + ringfort lore), and kin pills. Deactivation fades to 50%;
// the next selection repaints at full opacity.
//
// §5 of the interaction spec / §8 port mapping from the prototype.

import type { CSSProperties } from "react";
import type { NamespaceOption } from "../hooks/useNamespace";
import type { NamespaceSummaries } from "../hooks/useNamespaceSummaries";
import { WORLDS_LORE, GENERIC_WORLD_LORE } from "../lib/worldLore";
import { ICON_BASE, UNKNOWN_STONE } from "../lib/namespaceIcons";
import { SEAT_POOL } from "../lib/treeSeats";

const STATUS_COLOR: Record<string, string> = {
  running: "#6fb7d8",
  succeeded: "#79b356",
  failed: "#e07a3f",
  pending: "#5b6a5f",
};

interface Props {
  /** The world whose name/stats/lore to show (the last-seated world; survives deactivation). */
  titleWorldId: string | null;
  /** The world whose vine is currently open (null = nothing selected). */
  activeWorldId: string | null;
  namespaces: NamespaceOption[];
  summaries: NamespaceSummaries;
  /** seatIdx of the title world (for "lantern N of 11" label). */
  titleWorldSeatIdx: number | undefined;
  /** Select a world via a kin pill click — same path as a lantern tap. */
  onSelectWorld: (nsId: string) => void;
  compact?: boolean;
}

function opaqueIconUrl(nsId: string): string {
  const CURATED: Record<string, string> = {
    "fenrir-agents": "wolf-coins.png",
    "say-so-agents": "horn.png",
    "mytruthfinder-agents": "fionn-salmon.png",
    "shanaghy-com-agents": "webknot.png",
    "re-goatmower-agents": "mossiah.png",
    "odins-throne-hermes-agents": "candle.png",
  };
  return ICON_BASE + (CURATED[nsId] ?? UNKNOWN_STONE);
}

export function WorldTitle({
  titleWorldId,
  activeWorldId,
  namespaces,
  summaries,
  titleWorldSeatIdx,
  onSelectWorld,
  compact = false,
}: Props) {
  const isLive = activeWorldId !== null && activeWorldId === titleWorldId;
  const world = titleWorldId ? namespaces.find((ns) => ns.id === titleWorldId) : null;
  const summary = titleWorldId ? summaries[titleWorldId] : undefined;
  const jobs = summary?.jobs ?? [];

  const counts = {
    total: jobs.length,
    running: jobs.filter((j) => j.status === "running").length,
    pending: jobs.filter((j) => j.status === "pending").length,
    failed: jobs.filter((j) => j.status === "failed").length,
    succeeded: jobs.filter((j) => j.status === "succeeded").length,
  };
  const agents = new Set(jobs.map((j) => (j as { agent?: string }).agent ?? "")).size;

  const loreEntry = titleWorldId ? (WORLDS_LORE[titleWorldId] ?? null) : null;
  const loreText = loreEntry ? loreEntry.lore : GENERIC_WORLD_LORE;
  const kin = loreEntry?.kin ?? [];

  const cls = ["wtitle", isLive ? "is-live" : ""].filter(Boolean).join(" ");

  const compactStyle: CSSProperties = compact
    ? { padding: "6px 8px 6px", borderRadius: "10px" }
    : {};

  return (
    <div className={cls} aria-live="polite" style={compactStyle}>
      <div className="wtitle__row">
        <div className="wtitle__id">
          <h2 className="wtitle__name" style={compact ? { fontSize: "12px" } : undefined}>
            {world ? world.label : "no world seated"}
          </h2>
          <span className="wtitle__state" style={compact ? { fontSize: "8.5px" } : undefined}>
            {!world
              ? "the throne rests — click a lantern"
              : isLive
              ? "seated — its vine hangs open"
              : "resting — its lantern dims, its deeds remain"}
          </span>
        </div>
      </div>
      {world && (
        <>
          <div
            className="wtitle__stats"
            style={compact ? { gap: "2px 6px", margin: "4px 0 4px", fontSize: "9px" } : undefined}
          >
            <span className="st">
              <i style={{ background: "rgba(176,196,201,0.4)" }} />
              {counts.total} on the vine
            </span>
            {counts.running > 0 && (
              <span className="st">
                <i style={{ background: STATUS_COLOR.running }} />
                {counts.running} running
              </span>
            )}
            {counts.pending > 0 && (
              <span className="st">
                <i style={{ background: STATUS_COLOR.pending }} />
                {counts.pending} pending
              </span>
            )}
            {counts.failed > 0 && (
              <span className="st">
                <i style={{ background: STATUS_COLOR.failed }} />
                {counts.failed} failed
              </span>
            )}
            {counts.succeeded > 0 && (
              <span className="st">
                <i style={{ background: STATUS_COLOR.succeeded }} />
                {counts.succeeded} succeeded
              </span>
            )}
            {agents > 0 && (
              <span className="st">
                <i style={{ background: "rgba(176,196,201,0.25)" }} />
                {agents} agents
              </span>
            )}
            {titleWorldSeatIdx != null && (
              <span className="st">
                <i style={{ background: "rgba(176,196,201,0.14)" }} />
                lantern {titleWorldSeatIdx + 1} of {SEAT_POOL.length}
              </span>
            )}
          </div>
          <div className="wtitle__band">
            <div className="wtitle__garden" style={compact ? { minHeight: "44px" } : undefined}>
              <span className="ground" aria-hidden="true" />
              <img
                className="wtitle__stone"
                src={opaqueIconUrl(titleWorldId!)}
                alt=""
                aria-hidden="true"
                style={compact ? { width: "26px", height: "26px" } : undefined}
              />
            </div>
            <p
              className="wtitle__lore"
              style={compact ? { fontSize: "8.5px", lineHeight: "1.4", WebkitLineClamp: 3 } as CSSProperties : undefined}
            >
              {loreText}
            </p>
          </div>
          {kin.length > 0 && (
            <div
              className="wtitle__kin"
              style={compact ? { gap: "3px 4px", marginTop: "4px" } : undefined}
            >
              {kin.map((k) => {
                const kinWorld = namespaces.find((ns) => ns.id === k.id);
                if (!kinWorld) return null;
                return (
                  <button
                    key={k.id}
                    type="button"
                    className="wtitle__kin-pill"
                    title={`${kinWorld.label} — ${k.why}`}
                    aria-label={`Go to ${kinWorld.label}`}
                    style={compact ? { fontSize: "8.5px", padding: "1px 6px" } : undefined}
                    onClick={() => onSelectWorld(k.id)}
                  >
                    {kinWorld.label}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
