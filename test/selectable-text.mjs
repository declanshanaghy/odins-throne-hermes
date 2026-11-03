// Selectable text test — guards issue #46:
// every text node rendered by the plugin is selectable/copyable; `user-select:
// none` may exist only on genuine interactive chrome (click-to-collapse
// headers), each with a justifying comment; the vendored desktop/plugin.js
// bundle mirrors src/ui/styles/index.css; the served surfaces keep their
// copy-target (`user-select:all`) and chrome (`user-select:none`) rules.
//
// Run: npm test   (node --import ./test/register.mjs test/selectable-text.mjs)

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(REPO_ROOT, p), "utf8");

const css = read("src/ui/styles/index.css");
const plugin = read("desktop/plugin.js");

// Split the stylesheet into `selector { decls }` blocks (comments preserved so
// kept chrome can be checked for a justifying `issue #46` comment).
const blocks = [...css.matchAll(/([^{}\/]+)\{([^{}]*)\}/g)].map((m) => ({
  selector: m[1].trim(),
  decls: m[2],
}));

// ── 1. user-select:none lives ONLY on interactive chrome, with a comment ────
{
  const none = blocks.filter((b) => /user-select\s*:\s*none/.test(b.decls));
  assert.ok(none.length > 0, "expected at least one kept chrome user-select:none rule");
  for (const b of none) {
    assert.match(
      b.selector,
      /-header$/,
      `user-select:none must sit on interactive chrome (click-to-collapse header), got: ${b.selector}`,
    );
    assert.match(
      b.decls,
      /cursor\s*:\s*pointer/,
      `kept chrome rule "${b.selector}" must also carry cursor:pointer`,
    );
    assert.match(
      b.decls,
      /issue #46/,
      `kept chrome rule "${b.selector}" needs a justifying issue #46 comment`,
    );
  }
  // No stray user-select:none outside a -header rule anywhere in the stylesheet.
  const stray = blocks.filter(
    (b) => /user-select\s*:\s*none/.test(b.decls) && !/-header$/.test(b.selector),
  );
  assert.deepEqual(stray, [], "no user-select:none outside click-to-collapse headers");
}

// ── 2. content text is explicitly selectable (body opts in) ─────────────────
{
  const body = blocks.find((b) => /^body$/.test(b.selector));
  assert.ok(body, "body rule exists");
  assert.match(body.decls, /user-select\s*:\s*text/, "body guarantees content text selection");
}

// ── 3. vendored desktop/plugin.js mirrors src/ui/styles/index.css ────────────
{
  const count = (s, re) => (s.match(re) || []).length;
  const cssNone = count(css, /user-select\s*:\s*none/g);
  const pluginNone = count(plugin, /user-select\s*:\s*none/g);
  assert.equal(pluginNone, cssNone, "desktop/plugin.js user-select:none count mirrors index.css");
  assert.equal(
    count(plugin, /user-select\s*:\s*text/g),
    count(css, /user-select\s*:\s*text/g),
    "desktop/plugin.js user-select:text count mirrors index.css",
  );
  // The mirror carries the kept chrome rules' justifying comments too.
  assert.ok(
    cssNone > 0 && count(plugin, /user-select\s*:\s*none[^}]*issue #46/g) === cssNone,
    "each kept chrome rule in the bundle carries its issue #46 comment",
  );
}

// ── 4. served surfaces keep their copy-targets and chrome ───────────────────
{
  const indexTs = read("server/index.ts");
  const keyBox = /user-select\s*:\s*all/.exec(indexTs);
  assert.ok(keyBox, "server/index.ts key box keeps user-select:all (click-to-copy target)");

  const reportTs = read("server/report.ts");
  const turnHeader = /\.turn-header\s*\{[^}]*cursor\s*:\s*pointer[^}]*user-select\s*:\s*none/.exec(
    reportTs,
  );
  assert.ok(
    turnHeader,
    "server/report.ts .turn-header keeps user-select:none (click-to-collapse chrome)",
  );
}