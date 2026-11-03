// Web-target integration test (issue #18) — drives the REAL Vite config and
// the built dist-ui/ bundle, asserting the acceptance criteria:
//
//   1. build:web produces a serving web bundle from the same ui/ core the
//      plugin uses (index.html + hashed assets + copied /profiles portraits).
//   2. The namespace drilldown tree ships in the web build; the flat
//      NamespaceSelector is dead in both targets.
//   3. Same-origin /api and /ws URLs via the platform adapter — the seam
//      string literals survive minification, so the built bundle must
//      carry them; the dev proxy targets only localhost (no CORS anywhere).
//   4. CSS ships unscoped on web (no .odins-throne-root scoping).
//
// Run: npm test   (node --import ./test/register.mjs test/web-target.mjs)
// Builds dist-ui/ first if it is missing, so `npm test` alone exercises the
// full web pipeline.

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..");
const DIST = resolve(ROOT, "dist-ui");

// ── 1. the real vite config, transpiled by the loader ───────────────────────
const { default: viteConfig } = await import("../src/targets/web/vite.config.ts");

assert.equal(
  viteConfig.root ? resolve(viteConfig.root).endsWith("src/targets/web") : false,
  true,
  "vite root is src/targets/web (index.html beside main.tsx)",
);
assert.equal(
  resolve(viteConfig.build.outDir).endsWith("dist-ui"),
  true,
  "build output lands in dist-ui/",
);
assert.equal(
  resolve(viteConfig.publicDir).endsWith("src/assets"),
  true,
  "publicDir is src/assets — ships the /profiles portraits the adapter dials",
);
assert.ok(viteConfig.plugins.length > 0, "@vitejs/plugin-react registered");

// Same-origin dev proxy: only localhost targets — no CORS anywhere.
const proxy = viteConfig.server.proxy ?? {};
assert.ok(proxy["/ws"], "/ws proxied for local dev");
assert.equal(proxy["/ws"].ws, true, "/ws proxy is WebSocket-aware");
for (const [prefix, entry] of Object.entries(proxy)) {
  assert.ok(
    entry.target.startsWith("ws://localhost:") || entry.target.startsWith("http://localhost:"),
    `proxy target for ${prefix} is same-machine (${entry.target}) — no cross-origin`,
  );
}

// ── 2. the drilldown tree ships; the flat selector is dead in both ──────────
assert.ok(
  existsSync(resolve(ROOT, "src/ui/components/NamespaceTree.tsx")),
  "NamespaceTree component exists",
);
assert.ok(
  !existsSync(resolve(ROOT, "src/ui/components/NamespaceSelector.tsx")),
  "flat NamespaceSelector is dead in both targets",
);

// main.tsx installs the web adapter before render and consumes the ui core
// stylesheet unscoped.
const mainSrc = readFileSync(resolve(ROOT, "src/targets/web/main.tsx"), "utf8");
assert.ok(mainSrc.includes("setPlatform(webPlatform)"), "entry installs the web adapter");
assert.ok(
  mainSrc.indexOf("setPlatform(webPlatform)") < mainSrc.indexOf("createRoot("),
  "adapter installed before first render",
);
assert.ok(
  mainSrc.includes('import "../../ui/styles/index.css"'),
  "entry consumes the ui core stylesheet (Vite, unscoped)",
);

// ── 3. build dist-ui/ if missing, then assert the serving bundle ────────────
if (!existsSync(resolve(DIST, "index.html"))) {
  console.log("[web-target] dist-ui/ missing — running vite build…");
  const res = spawnSync(
    process.execPath,
    [resolve(ROOT, "node_modules/vite/bin/vite.js"), "build", "-c", "src/targets/web/vite.config.ts"],
    { cwd: ROOT, encoding: "utf8", timeout: 240_000 },
  );
  assert.equal(res.status, 0, `vite build failed:\n${res.stdout}\n${res.stderr}`);
}

assert.ok(existsSync(resolve(DIST, "index.html")), "dist-ui/index.html exists (serving bundle)");

const html = readFileSync(resolve(DIST, "index.html"), "utf8");
assert.ok(html.includes('id="root"'), "index.html mounts into #root");
const bundleMatch = html.match(/src="([^"]*\.js)"/);
assert.ok(bundleMatch, "index.html references the hashed JS bundle");
const js = readFileSync(resolve(DIST, bundleMatch[1].replace(/^\//, "")), "utf8");

// The web adapter's same-origin seam literals survive minification.
assert.ok(js.includes("/ws?namespace="), "bundle dials the same-origin /ws socket");
assert.ok(js.includes("/profiles/"), "bundle resolves portraits via /profiles URLs");
assert.ok(!js.includes("Access-Control-"), "no CORS handshaking in the bundle");
// The namespace drilldown tree ships in the web build.
assert.ok(js.includes("ns-tree"), "namespace drilldown tree ships in the bundle");

// CSS unscoped on web: the plugin's scoping class must not appear in the
// built stylesheet — only as the shell's own layout div classname in the JS.
const cssFiles = readdirSync(resolve(DIST, "assets")).filter((f) => f.endsWith(".css"));
assert.ok(cssFiles.length > 0, "stylesheet emitted beside the JS bundle");
const css = readFileSync(resolve(DIST, "assets", cssFiles[0]), "utf8");
assert.ok(!css.includes(".odins-throne-root "), "web CSS is not scoped to the plugin root class");

// publicDir: the /profiles portraits the adapter's URLs resolve against.
assert.ok(
  existsSync(resolve(DIST, "profiles/odin-dark.png")),
  "profiles copied into the bundle — same-origin portrait URLs resolve",
);
assert.ok(existsSync(resolve(DIST, "odin-dark.png")), "favicon shipped at /odin-dark.png");

console.log("WEB-TARGET PASS — Vite bundle serves from dist-ui/ (same ui core, tree shipped, same-origin /ws + /profiles seams, CSS unscoped)");
