#!/usr/bin/env python3
"""
detect-lanterns.py — map the painted leaf-lanterns of the Odin's Throne tree
backdrop to SEAT_POOL coordinates (PAINTING %).

The shipped backdrop (src/ui/assets/tree-backdrop.jpg, 896x1200) carries
eleven painted lanterns by contract. SEAT_POOL in src/ui/lib/treeSeats.ts
must list one seat per painted lantern — coordinates are PAINTING percent
(x from left edge, y from top edge, at the lantern's bright-spot centroid) —
or the namespace stones render OFF their lanterns. Standing decree
(Declan, 2026-11-04): every namespace location must overlap a lantern's
bright spot.

Run from the repo root:

    python3 scripts/detect-lanterns.py
    python3 scripts/detect-lanterns.py --json
    python3 scripts/detect-lanterns.py --image src/ui/assets/tree-backdrop.jpg

How it detects: lanterns are the only LARGE bright teal-glowing blobs on
the tree — pixels with luminance > 150 where green+blue dominate red
(teal-ness > 0.28), flood-filled into blobs, area >= --min-area (default
1000 px). Stars are tiny and never pass the area gate; the moon is
excluded by x > 60% (the composition keeps every lantern in the left half —
see src/ui/assets/README.md). Output is the blob centroid = the bright spot.

After a repaint or a seat fix, the new SEAT_POOL must land VERBATIM in all
four contract sites (see the odins-throne-tree skill):

  1. src/ui/lib/treeSeats.ts            (SEAT_POOL + CURATED_SEATS)
  2. test/tree-seats.mjs                 (PROTOTYPE_SEAT_POOL + expectations)
  3. design/tree-display/tree-display-prototype.html on branch design-tree-display
  4. ~/.hermes/cache/scratch/odins-icon-mockup/tree-display-prototype.html

Exit code 0 only when exactly eleven lanterns are found.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import deque
from typing import cast

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow required: pip install pillow (or run under an env that has it)")

REPO_DEFAULT = "src/ui/assets/tree-backdrop.jpg"
EXPECT_LANTERNS = 11
MOON_MAX_X_PERCENT = 60.0  # lanterns are painted in the left half; the moon sits right of this


def detect(path: str, lum_thresh: float, teal_thresh: float, min_area: int):
    img = Image.open(path).convert("RGB")
    W, H = img.size
    # getdata() is a flat pixel sequence at runtime; PIL's stubs type it as an
    # opaque ImagingCore, so cast to the real shape.
    data = cast("list[tuple[int, int, int]]", img.getdata())

    lum: list[list[float]] = [[0.0] * W for _ in range(H)]
    teal: list[list[float]] = [[0.0] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            r, g, b = data[y * W + x]
            L = 0.299 * r + 0.587 * g + 0.114 * b
            lum[y][x] = L
            if r + g + b > 0:
                teal[y][x] = ((g + b) / (r + g + b)) * (L / 255)

    visited = [[False] * W for _ in range(H)]
    lanterns = []
    for y in range(H):
        for x in range(W):
            if visited[y][x]:
                continue
            if lum[y][x] <= lum_thresh or teal[y][x] <= teal_thresh:
                continue
            q = deque([(x, y)])
            visited[y][x] = True
            pts = []
            while q:
                cx, cy = q.popleft()
                pts.append((cx, cy))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if (
                        0 <= nx < W and 0 <= ny < H and not visited[ny][nx]
                        and lum[ny][nx] > lum_thresh and teal[ny][nx] > teal_thresh
                    ):
                        visited[ny][nx] = True
                        q.append((nx, ny))
            n = len(pts)
            if n < min_area:
                continue
            sx = sum(p[0] for p in pts) / n
            sy = sum(p[1] for p in pts) / n
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            lanterns.append(
                {
                    "area": n,
                    "cx": sx,
                    "cy": sy,
                    "x_percent": round(sx / W * 100, 1),
                    "y_percent": round(sy / H * 100, 1),
                    "w": max(xs) - min(xs) + 1,
                    "h": max(ys) - min(ys) + 1,
                    "peak": round(max(lum[p[1]][p[0]] for p in pts)),
                    "is_moon": (sx / W * 100) > MOON_MAX_X_PERCENT,
                }
            )
    lanterns.sort(key=lambda l: (l["is_moon"], -l["area"]))
    return W, H, lanterns


def main() -> int:
    ap = argparse.ArgumentParser(description="Detect painted lanterns in the tree backdrop.")
    ap.add_argument("--image", default=REPO_DEFAULT, help=f"backdrop path (default: {REPO_DEFAULT})")
    ap.add_argument("--lum", type=float, default=150.0, help="luminance threshold (default 150)")
    ap.add_argument("--teal", type=float, default=0.28, help="teal-ness threshold (default 0.28)")
    ap.add_argument("--min-area", type=int, default=1000, help="min blob area in px (default 1000)")
    ap.add_argument("--json", action="store_true", help="emit JSON instead of tables")
    args = ap.parse_args()

    W, H, blobs = detect(args.image, args.lum, args.teal, args.min_area)
    lanterns = [b for b in blobs if not b["is_moon"]]
    excluded = [b for b in blobs if b["is_moon"]]

    if args.json:
        print(json.dumps({"size": [W, H], "lanterns": lanterns, "excluded_moon": excluded}, indent=2))
    else:
        print(f"image: {args.image} ({W}x{H})")
        print(f"{'area':>6} {'x%':>5} {'y%':>5} {'w':>4} {'h':>4} {'peak':>5}  note")
        for b in lanterns:
            print(
                f"{b['area']:>6} {b['x_percent']:>5} {b['y_percent']:>5} "
                f"{b['w']:>4} {b['h']:>4} {b['peak']:>5}  lantern"
            )
        for b in excluded:
            print(
                f"{b['area']:>6} {b['x_percent']:>5} {b['y_percent']:>5} "
                f"{b['w']:>4} {b['h']:>4} {b['peak']:>5}  EXCLUDED (moon / right-half)"
            )

        # Ready-to-paste SEAT_POOL block, bottom-up (largest y first), 4 per line,
        # matching the formatting of src/ui/lib/treeSeats.ts.
        pts = sorted(lanterns, key=lambda b: -b["y_percent"])
        lines = []
        for i in range(0, len(pts), 4):
            chunk = pts[i : i + 4]
            lines.append("  " + " ".join(f"{{ x: {round(p['x_percent'])}, y: {round(p['y_percent'])} }}," for p in chunk))
        if lines:
            lines[-1] = lines[-1].rstrip(",")
        print("\nSEAT_POOL (PAINTING %, bottom-up — re-order to keep CURATED_SEATS indices valid when fixing, not repainting):")
        print("export const SEAT_POOL: readonly PaintedSeat[] = [")
        print("\n".join(lines))
        print("];")

    if len(lanterns) != EXPECT_LANTERNS:
        print(
            f"\nERROR: expected {EXPECT_LANTERNS} lanterns, found {len(lanterns)} — "
            "tune --lum/--teal/--min-area or the backdrop is off-contract",
            file=sys.stderr,
        )
        return 1
    print(f"\nok: {EXPECT_LANTERNS} lanterns detected", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())