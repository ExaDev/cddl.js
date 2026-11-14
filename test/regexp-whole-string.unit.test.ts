// RFC 8610 section 3.8.3: a `.regexp` control matches only a text string that the whole expression matches, so the emitted schema must refuse a value that merely contains a match.

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { emitModule } from "../src/emitter.ts";
import { parse } from "../vendor/cddl/dist/index.js";

interface Parser {
  safeParse: (value: unknown) => { success: boolean };
}

function emitFor(cddlSource: string): string {
  const dir = mkdtempSync(join(tmpdir(), "cddl-regexp-emit-"));
  const cddlPath = join(dir, "spec.cddl");
  writeFileSync(cddlPath, cddlSource);

  return emitModule(parse(cddlPath));
}

async function schemaFor(
  cddlSource: string,
  exportName: string,
): Promise<Parser> {
  const dir = mkdtempSync(join(tmpdir(), "cddl-regexp-whole-"));
  const cddlPath = join(dir, "spec.cddl");
  writeFileSync(cddlPath, cddlSource);
  const outPath = join(dir, "generated.ts");
  writeFileSync(outPath, emitModule(parse(cddlPath)));
  const imported: unknown = await import(pathToFileURL(outPath).href);
  if (
    typeof imported !== "object" ||
    imported === null ||
    !(exportName in imported)
  ) {
    throw new Error(`generated module is missing ${exportName}`);
  }
  const schema: unknown = Reflect.get(imported, exportName);
  if (
    typeof schema !== "object" ||
    schema === null ||
    !("safeParse" in schema) ||
    typeof schema.safeParse !== "function"
  ) {
    throw new Error(`${exportName} is not a schema`);
  }

  // The export is a Zod schema; safeParse's presence was checked above and the result shape is the only part used.
  return schema as Parser;
}

describe("a .regexp control matches the whole text string", () => {
  it("refuses a prefix, a suffix and a trailing line terminator around a valid match", async () => {
    const schema = await schemaFor(
      'id = tstr .regexp "[a-z]+-[0-9]+"\n',
      "idSchema",
    );
    expect(schema.safeParse("abc-123").success).toBe(true);
    expect(schema.safeParse("!abc-123").success).toBe(false);
    expect(schema.safeParse("abc-123!").success).toBe(false);
    expect(schema.safeParse("abc-123\n").success).toBe(false);
    expect(schema.safeParse("\nabc-123").success).toBe(false);
    expect(schema.safeParse("abc-123\r").success).toBe(false);
    expect(schema.safeParse("abc-123\u2028").success).toBe(false);
    expect(schema.safeParse("abc-123\u2029").success).toBe(false);
  });

  it("applies top-level alternation to the whole string, not to each branch's edge", async () => {
    const schema = await schemaFor('ab = tstr .regexp "a|b"\n', "abSchema");
    expect(schema.safeParse("a").success).toBe(true);
    expect(schema.safeParse("b").success).toBe(true);
    expect(schema.safeParse("ab").success).toBe(false);
    expect(schema.safeParse("xa").success).toBe(false);
    expect(schema.safeParse("bx").success).toBe(false);
  });

  it("counts a code point as one character and reads \\p{...} as a property", async () => {
    const dot = await schemaFor('one = tstr .regexp "."\n', "oneSchema");
    expect(dot.safeParse("\u{1F600}").success).toBe(true);
    expect(dot.safeParse("ab").success).toBe(false);
    const letters = await schemaFor(
      'word = tstr .regexp "\\\\p{L}+"\n',
      "wordSchema",
    );
    expect(letters.safeParse("abc").success).toBe(true);
    expect(letters.safeParse("p{L}").success).toBe(false);
  });

  it("rejects at emission an operand that is not a valid pattern, naming the rule", () => {
    expect(() => emitFor('bad = tstr .regexp "x)|(y"\n')).toThrow(/"bad"/);
    expect(() => emitFor('bad = tstr .regexp "a\\\\"\n')).toThrow(/"bad"/);
    expect(() => emitFor('bad = tstr .regexp "(?i)a"\n')).toThrow(/"bad"/);
  });

  it("rejects at emission a non-string operand, naming the rule", () => {
    expect(() => emitFor("bad = tstr .regexp 5\n")).toThrow(/"bad"/);
  });

  it("keeps the meaning of an operand that already carries its own anchors", async () => {
    const schema = await schemaFor(
      'anchored = tstr .regexp "^x$"\n',
      "anchoredSchema",
    );
    expect(schema.safeParse("x").success).toBe(true);
    expect(schema.safeParse("xx").success).toBe(false);
    expect(schema.safeParse("x\n").success).toBe(false);
  });
});
