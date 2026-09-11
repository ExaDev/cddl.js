// Regression coverage for a real lexer bug: readString() used to return a CDDL text-string literal's raw, unescaped source slice, so a `.regexp` pattern containing an escaped backslash (`\\.`, `\\+`) carried an extra literal backslash all the way into the emitted `new RegExp(...)` call, silently changing what the pattern matches (e.g. `\\+` reads as "one or more backslashes" instead of a literal `+`). Caught against wire-mesh's real `namespaced-domain-id` rule, which has shipped with this bug since before this project existed -- these tests pin both that rule and the DM-room-path shape that surfaced it against wire-mesh's real fixture spec, so a regression here is caught immediately rather than rediscovered by hand in a downstream consumer.

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { emitModule } from "../src/emitter.ts";
import { parse } from "../vendor/cddl/dist/index.js";

function parseAndEmit(cddlSource: string): string {
  const dir = mkdtempSync(join(tmpdir(), "cddl-regexp-escape-"));
  const path = join(dir, "spec.cddl");
  writeFileSync(path, cddlSource);
  const parsed = parse(path);
  return emitModule(parsed);
}

describe("a CDDL .regexp literal's escaped backslash survives to the emitted RegExp unchanged", () => {
  it("a rule pairing two 64-hex components with an escaped literal '+' matches a real pair", async () => {
    const source =
      'dm-room-path = tstr .regexp "[0-9a-f]{64}\\\\+[0-9a-f]{64}"\n';
    const generatedDir = mkdtempSync(join(tmpdir(), "cddl-regexp-escape-out-"));
    const outPath = join(generatedDir, "generated.ts");
    writeFileSync(outPath, parseAndEmit(source));
    const imported: unknown = await import(pathToFileURL(outPath).href);
    if (
      typeof imported !== "object" ||
      imported === null ||
      !("dmRoomPathSchema" in imported)
    ) {
      throw new Error("generated module is missing dmRoomPathSchema");
    }
    const schema = imported.dmRoomPathSchema as {
      safeParse: (value: unknown) => { success: boolean };
    };
    const deviceIdHexLength = 64; // matches the {64} quantifier in the pattern under test
    const a = "a".repeat(deviceIdHexLength);
    const b = "b".repeat(deviceIdHexLength);
    expect(schema.safeParse(`${a}+${b}`).success).toBe(true);
    expect(schema.safeParse(`${a}\\+${b}`).success).toBe(false);
  });

  it("wire-mesh's real namespaced-domain-id rule matches a genuine dotted registrant domain", async () => {
    const source =
      'namespaced-domain-id = tstr .regexp "[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+/[A-Za-z0-9_.-]+"\n';
    const generatedDir = mkdtempSync(join(tmpdir(), "cddl-regexp-escape-out-"));
    const outPath = join(generatedDir, "generated.ts");
    writeFileSync(outPath, parseAndEmit(source));
    const imported: unknown = await import(pathToFileURL(outPath).href);
    if (
      typeof imported !== "object" ||
      imported === null ||
      !("namespacedDomainIdSchema" in imported)
    ) {
      throw new Error("generated module is missing namespacedDomainIdSchema");
    }
    const schema = imported.namespacedDomainIdSchema as {
      safeParse: (value: unknown) => { success: boolean };
    };
    expect(schema.safeParse("exadev.io/agent-comms").success).toBe(true);
    expect(schema.safeParse("not-a-domain").success).toBe(false);
  });
});
