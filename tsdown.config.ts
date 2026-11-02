import { defineConfig } from "tsdown";

/**
 * src/emitter.ts (emitModule/mergeRules), src/runtime.ts (cborDecodesAs), and src/parse.ts (parse, re-exported from the vendored parser) are the library's public surface, built directly as separate entries rather than through a re-exporting index.ts -- the project's barrel-policy lint rule requires importing straight from the module that owns each export. Each is built dual ESM/CJS with declarations so it resolves correctly under every module system; attw verifies that claim directly rather than trusting it. src/cli.ts (a script, not library surface) is deliberately not part of this build; vendor/cddl is compiled separately via its own tsc step (see package.json's _vendor:build), which src/parse.ts's own bundling depends on.
 */
const esmOnlyDependencies = ["camelcase", "cbor2"];

export default defineConfig({
  entry: ["src/emitter.ts", "src/runtime.ts", "src/parse.ts"],
  format: {
    esm: {},
    cjs: {
      // camelcase and cbor2 are ESM-only. Left external, the CJS bundle `require`s them: that throws ERR_REQUIRE_ESM on Node before 22.12, and on later versions interop wraps the namespace so a default import is the namespace object rather than the function. Bundling them makes the CJS entries self-contained. zod stays external: it ships a CJS build, and generated modules must share the consumer's copy. onlyBundle makes any other dependency reaching the bundle (including cbor2's own @cto.af/wtf8) a build error until it is listed here deliberately.
      deps: {
        alwaysBundle: (id) => esmOnlyDependencies.includes(id),
        onlyBundle: [...esmOnlyDependencies, "@cto.af/wtf8"],
        dts: {},
      },
    },
  },
  dts: true,
  exports: true,
  attw: { profile: "node16" },
  clean: true,
});
