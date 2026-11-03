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
import { createRequire } from "node:module";
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
  // CJS packages: mapped with format "cjs-wrap" so the load hook generates a
  // proper ESM wrapper via createRequire. Node.js 20's loader-hook CJS interop
  // returns an empty object for format:"commonjs" in resolve results; wrapping
  // ensures named exports (e.g. Component from react, JSDOM from jsdom) work.
  react: { path: join(NODE_MODULES, "react", "index.js"), format: "cjs-wrap" },
  "react/jsx-runtime": { path: join(NODE_MODULES, "react", "jsx-runtime.js"), format: "cjs-wrap" },
  jsdom: { path: join(NODE_MODULES, "jsdom", "lib", "api.js"), format: "cjs-wrap" },
};

export async function resolve(specifier, context, next) {
  const target = MAP[specifier];
  if (target) {
    // "cjs-wrap" is handled in the load hook; pass a sentinel format to route it.
    return { url: toURL(target.path).href, format: target.format, shortCircuit: true };
  }
  // Source-tree TS modules use bundler-style extensionless relative imports;
  // Node ESM needs the explicit extension.
  const parentInSrc = context.parentURL?.includes("/src/") ?? false;
  if (parentInSrc && (specifier.startsWith("./") || specifier.startsWith("../")) && !/\.[a-z]+$/i.test(specifier)) {
    for (const ext of [".ts", ".tsx"]) {
      try {
        return await next(specifier + ext, context);
      } catch {
        // try the next extension / fall through to the default resolution
      }
    }
  }
  // server/**.ts uses bundler-style "./x.js" specifiers (the TS convention
  // that maps to x.ts); Node ESM needs the real .ts file (test/smoke.mjs
  // imports the Hono app straight from source for the issue #55 cache
  // header checks).
  const parentInServer = context.parentURL?.includes("/server/") ?? false;
  if (parentInServer && specifier.startsWith("./") && specifier.endsWith(".js")) {
    const tsSpecifier = specifier.slice(0, -3) + ".ts";
    try {
      return await next(tsSpecifier, context);
    } catch {
      // fall through to the default resolution (a real .js may exist)
    }
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  // CJS-wrap: generate an ESM module that uses createRequire to load the CJS
  // package and re-export its named exports. This is needed because Node.js 20's
  // loader-hook CJS interop returns an empty {} default for format:"commonjs".
  if (context.format === "cjs-wrap" && url.startsWith("file:")) {
    const filePath = fileURLToPath(url);
    // Synchronously load the CJS module to discover its export names, then
    // generate a static ESM wrapper that re-exports everything.
    const req = createRequire(import.meta.url);
    let exports_obj;
    try { exports_obj = req(filePath); } catch { exports_obj = {}; }
    const keys = Object.keys(exports_obj).filter(k => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k));
    const wrapper = [
      `import { createRequire } from "node:module";`,
      `const _m = createRequire(import.meta.url)(${JSON.stringify(filePath)});`,
      `export default _m;`,
      keys.length ? `export const { ${keys.join(", ")} } = _m;` : "",
    ].join("\n");
    return { format: "module", source: wrapper, shortCircuit: true };
  }
  // Transpile src/**/*.{ts,tsx} with esbuild (the same compiler the build uses).
  // Also server/**/*.ts — plain-node test suites import the Hono app straight
  // from source (test/smoke.mjs, issue #55 cache-bust checks); importing the
  // module is side-effect-free (the listener only boots when run as main).
  if (
    url.startsWith("file:") &&
    (url.includes("/src/") || url.includes("/server/")) &&
    (url.endsWith(".ts") || url.endsWith(".tsx"))
  ) {
    const source = readFileSync(fileURLToPath(url), "utf8");
    const loader = url.endsWith(".tsx") ? "tsx" : "ts";
    const { code } = await transform(source, { loader, format: "esm", target: "es2022", jsx: "automatic" });
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
