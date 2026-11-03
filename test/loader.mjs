// Node ESM resolve hook: point the plugin's runtime externals at this harness —
// @hermes/plugin-sdk at the stub, react/react-jsx-runtime at the Hermes
// desktop app's own copies (the same tree test/smoke.mjs imports react-dom
// from, so React stays a singleton across the plugin and the renderer).
//
// Falls back to the project's own node_modules when hermes-agent is absent
// (CI sandboxes, GKE Autopilot). The hermes-agent copy takes precedence when
// present so production and test environments stay aligned.

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL as toURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

// Prefer the Hermes checkout's React; fall back to locally installed copies.
const HERMES_NODE_MODULES = `${process.env.HOME}/.hermes/hermes-agent/node_modules`;
const LOCAL_NODE_MODULES = join(repoRoot, "node_modules");
const NODE_MODULES = existsSync(join(HERMES_NODE_MODULES, "react", "index.js"))
  ? HERMES_NODE_MODULES
  : LOCAL_NODE_MODULES;

const MAP = {
  "@hermes/plugin-sdk": { path: join(here, "sdk-stub.mjs"), format: "module" },
  react: { path: join(NODE_MODULES, "react", "index.js"), format: "commonjs" },
  "react/jsx-runtime": { path: join(NODE_MODULES, "react", "jsx-runtime.js"), format: "commonjs" },
  jsdom: { path: join(NODE_MODULES, "jsdom", "lib", "api.js"), format: "commonjs" },
};

export async function resolve(specifier, context, next) {
  const target = MAP[specifier];
  if (target) {
    return { url: toURL(target.path).href, format: target.format, shortCircuit: true };
  }
  return next(specifier, context);
}
