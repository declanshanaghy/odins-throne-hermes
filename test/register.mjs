import { register } from "node:module";

// Resolve ./loader.mjs relative to THIS file.
register(new URL("./loader.mjs", import.meta.url), import.meta.url);
