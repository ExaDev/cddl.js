import { defineConfig } from "tsdown";

// src/emitter.ts (emitModule/mergeRules), src/runtime.ts (cborDecodesAs), and src/parse.ts (parse, re-exported from the vendored parser) are the library's public surface, built directly as separate entries rather than through a re-exporting index.ts -- the project's barrel-policy lint rule requires importing straight from the module that owns each export. Each is built dual ESM/CJS with declarations so it resolves correctly under every module system; attw verifies that claim directly rather than trusting it. src/cli.ts (a script, not library surface) is deliberately not part of this build; vendor/cddl is compiled separately via its own tsc step (see package.json's _vendor:build), which src/parse.ts's own bundling depends on.
export default defineConfig({
  entry: ["src/emitter.ts", "src/runtime.ts", "src/parse.ts"],
  format: ["esm", "cjs"],
  dts: true,
  exports: true,
  attw: { profile: "node16" },
  clean: true,
});
