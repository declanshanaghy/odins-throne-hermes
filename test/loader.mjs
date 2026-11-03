// Node ESM resolve hook: point the plugin's runtime externals at this harness —
// @hermes/plugin-sdk at the stub, react/react-jsx-runtime at the Hermes
// desktop app's own copies (the same tree test/smoke.mjs imports react-dom
// from, so React stays a singleton across the plugin and the renderer).

import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL as toURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// The Hermes checkout's React — same modules react-dom will use.
const HERMES_NODE_MODULES = `${process.env.HOME}/.hermes/hermes-agent/node_modules`;

const MAP = {
  "@hermes/plugin-sdk": { path: join(here, "sdk-stub.mjs"), format: "module" },
  react: { path: join(HERMES_NODE_MODULES, "react", "index.js"), format: "commonjs" },
  "react/jsx-runtime": { path: join(HERMES_NODE_MODULES, "react", "jsx-runtime.js"), format: "commonjs" },
  jsdom: { path: join(HERMES_NODE_MODULES, "jsdom", "lib", "api.js"), format: "commonjs" },
};

export async function resolve(specifier, context, next) {
  const target = MAP[specifier];
  if (target) {
    return { url: toURL(target.path).href, format: target.format, shortCircuit: true };
  }
  return next(specifier, context);
}
