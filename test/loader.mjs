// Node ESM resolve/load hooks: point the plugin's runtime externals at this
// harness — @hermes/plugin-sdk at the stub, react/react-jsx-runtime at the
// Hermes desktop app's own copies (the same tree test/smoke.mjs imports
// react-dom from, so React stays a singleton across the plugin and the
// renderer) — and transpile src/**.ts on the fly so unit tests can import the
// platform adapters straight from source (test/platform.mjs).
//
// Falls back to the project's own node_modules when hermes-agent is absent
// (CI sandboxes, GKE Autopilot). The hermes-agent copy takes precedence when
// present so production and test environments stay aligned.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL as toURL } from "node:url";
import { transform } from "esbuild";

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
  // Source-tree TS modules use bundler-style extensionless relative imports;
  // Node ESM needs the explicit extension.
  const parentInSrc = context.parentURL?.includes("/src/") ?? false;
  if (parentInSrc && (specifier.startsWith("./") || specifier.startsWith("../")) && !/\.[a-z]+$/i.test(specifier)) {
    try {
      return await next(specifier + ".ts", context);
    } catch {
      // fall through to the default resolution
    }
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  // Transpile src/**.ts with esbuild (the same compiler the build uses).
  if (url.startsWith("file:") && url.includes("/src/") && url.endsWith(".ts")) {
    const source = readFileSync(fileURLToPath(url), "utf8");
    const { code } = await transform(source, { loader: "ts", format: "esm", target: "es2022" });
    return { format: "module", source: code, shortCircuit: true };
  }
  // PNG imports inside transpiled modules (the plugin adapter's portraits):
  // stand in the module URL for the bundled data URL — enough for the seam
  // test to assert the adapter resolves portraits, without inlining bytes.
  if (url.startsWith("file:") && url.endsWith(".png")) {
    return { format: "module", source: `export default ${JSON.stringify(url)};\n`, shortCircuit: true };
  }
  return next(url, context);
}
