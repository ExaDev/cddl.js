import { defineConfig } from "tsdown";

// src/emitter.ts (emitModule/mergeRules) and src/runtime.ts (cborDecodesAs) are the library's public surface, built directly as separate entries rather than through a re-exporting index.ts -- the project's barrel-policy lint rule requires importing straight from the module that owns each export. Each is built dual ESM/CJS with declarations so it resolves correctly under every module system; attw verifies that claim directly rather than trusting it. src/cli.ts (a script, not library surface) and vendor/cddl (compiled separately, via its own tsc step -- see package.json's _vendor:build) are deliberately not part of this build.
export default defineConfig({
  entry: ["src/emitter.ts", "src/runtime.ts"],
  format: ["esm", "cjs"],
  dts: true,
  exports: true,
  attw: { profile: "node16" },
  clean: true,
});
