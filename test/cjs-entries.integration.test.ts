// Loads the built CommonJS entries through the package's own `exports` map (self-reference by package name resolves the `require` condition) in a child Node process with `require()` of ES modules disabled. The CJS bundle must therefore be self-contained: an ESM-only dependency left as an external `require` either fails to load or, once wrapped for interop, hands back a namespace object instead of the function (`camelcase.default is not a function`). Runs against dist/, so the build precedes the tests (turbo `_test` depends on `_build`).
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function runCjs(script: string): string {
  return execFileSync(
    process.execPath,
    ["--no-experimental-require-module", "-e", script],
    { cwd: repoRoot, encoding: "utf8" },
  );
}

function writeCddl(source: string): string {
  const path = join(mkdtempSync(join(tmpdir(), "cddl-cjs-")), "spec.cddl");
  writeFileSync(path, source);

  return path;
}

describe("the CommonJS build resolved through the package exports map", () => {
  it("parses a CDDL file and emits a Zod module from require('cddl.js/parse') and require('cddl.js/emitter')", () => {
    const cddlPath = writeCddl("person = { name: tstr }\n");
    const emitted = runCjs(`
      const { parse } = require("cddl.js/parse");
      const { emitModule } = require("cddl.js/emitter");
      process.stdout.write(emitModule(parse(${JSON.stringify(cddlPath)})));
    `);
    expect(emitted).toContain("export const personSchema");
    expect(emitted).toContain("export type Person");
  });

  it("exports mergeRules from require('cddl.js/emitter')", () => {
    expect(
      runCjs(
        `process.stdout.write(typeof require("cddl.js/emitter").mergeRules);`,
      ),
    ).toBe("function");
  });

  it("validates embedded CBOR through require('cddl.js/runtime')", () => {
    const outcome = runCjs(`
      const { z } = require("zod");
      const { cborDecodesAs } = require("cddl.js/runtime");
      const schema = cborDecodesAs(z.string());
      // 0x62 0x68 0x69 is the CBOR text string "hi"; 0x01 is the unsigned integer 1.
      process.stdout.write(JSON.stringify([
        schema.safeParse(Uint8Array.of(0x62, 0x68, 0x69)).success,
        schema.safeParse(Uint8Array.of(0x01)).success,
      ]));
    `);
    expect(JSON.parse(outcome)).toEqual([true, false]);
  });
});
