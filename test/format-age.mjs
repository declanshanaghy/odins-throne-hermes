// Unit tests for formatAge (src/ui/lib/formatAge.ts, issue #109).
//
// Verifies:
//   1. null startTime → "?"
//   2. <60s → "Xs" (at least "1s")
//   3. 1-59 minutes → "Nm"
//   4. 1-23 hours → "Nh"
//   5. 24h+ → "Nd"
//   6. now parameter is injectable (deterministic tests)
//
// Run: npm test   (node --import ./test/register.mjs test/format-age.mjs)

import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

const tmp = mkdtempSync(join(tmpdir(), "format-age-"));
const src = readFileSync(new URL("../src/ui/lib/formatAge.ts", import.meta.url), "utf8");
const { code } = transformSync(src, { loader: "ts", format: "esm" });
writeFileSync(join(tmp, "formatAge.mjs"), code);
const { formatAge } = await import(pathToFileURL(join(tmp, "formatAge.mjs")).href);

const NOW = 1_700_000_000_000; // fixed epoch for deterministic assertions

// null startTime
assert.equal(formatAge(null, NOW), "?", "null → ?");

// seconds (< 60s)
assert.equal(formatAge(NOW - 30_000, NOW), "30s", "30 seconds");
assert.equal(formatAge(NOW - 500, NOW), "1s", "sub-second rounds to 1s");
assert.equal(formatAge(NOW - 59_000, NOW), "59s", "59 seconds");

// minutes (60s – 59m59s)
assert.equal(formatAge(NOW - 60_000, NOW), "1m", "1 minute");
assert.equal(formatAge(NOW - 3 * 60_000, NOW), "3m", "3 minutes");
assert.equal(formatAge(NOW - 59 * 60_000, NOW), "59m", "59 minutes");

// hours (1h – 23h59m)
assert.equal(formatAge(NOW - 60 * 60_000, NOW), "1h", "1 hour");
assert.equal(formatAge(NOW - 2 * 60 * 60_000, NOW), "2h", "2 hours");
assert.equal(formatAge(NOW - 23 * 60 * 60_000, NOW), "23h", "23 hours");

// days (≥24h)
assert.equal(formatAge(NOW - 24 * 60 * 60_000, NOW), "1d", "1 day");
assert.equal(formatAge(NOW - 7 * 24 * 60 * 60_000, NOW), "7d", "7 days");

// future startTime (should clamp to 0 → "1s")
assert.equal(formatAge(NOW + 5_000, NOW), "1s", "future startTime clamps to 1s");

console.log("format-age: all assertions passed");
