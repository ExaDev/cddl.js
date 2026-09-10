// Proves cddl.js's generated schemas against real-world ground truth: for every conformance vector wire-mesh records, the vector's raw CBOR bytes decode into something the corresponding generated Zod schema accepts, and re-encoding the validated value reproduces the original bytes exactly. This is cddl.js's own definition of done, not merely a smoke test.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { decode, encode, cdeDecodeOptions, cdeEncodeOptions } from "cbor2";
import { emitModule } from "../src/emitter.ts";
import { parse } from "../vendor/cddl/dist/index.js";

interface Vector {
  name: string;
  wire_hex: string;
}

interface VectorFile {
  vectors: Vector[];
}

function isVectorFile(value: unknown): value is VectorFile {
  if (typeof value !== "object" || value === null) return false;
  if (!("vectors" in value) || !Array.isArray(value.vectors)) return false;
  return value.vectors.every(
    (v: unknown) =>
      typeof v === "object" &&
      v !== null &&
      "name" in v &&
      "wire_hex" in v &&
      typeof v.name === "string" &&
      typeof v.wire_hex === "string",
  );
}

function readVectors(filename: string): Vector[] {
  const path = fileURLToPath(new URL(`fixtures/${filename}`, import.meta.url));
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isVectorFile(raw)) {
    throw new Error(`${filename} is not a valid vector file`);
  }
  return raw.vectors;
}

interface GeneratedSchemas {
  frameSchema: {
    safeParse: (value: unknown) => { success: boolean; data?: unknown };
  };
  capabilityTokenSchema: {
    safeParse: (value: unknown) => { success: boolean; data?: unknown };
  };
}

function isGeneratedSchemas(value: unknown): value is GeneratedSchemas {
  if (typeof value !== "object" || value === null) return false;
  return "frameSchema" in value && "capabilityTokenSchema" in value;
}

let schemas: GeneratedSchemas;

beforeAll(async () => {
  const cddlPath = fileURLToPath(
    new URL("fixtures/protocol.cddl", import.meta.url),
  );
  const parsed = parse(cddlPath);
  const source = emitModule(parsed);

  const generatedDir = fileURLToPath(
    new URL("fixtures/generated/", import.meta.url),
  );
  mkdirSync(generatedDir, { recursive: true });
  const generatedUrl = new URL(
    "fixtures/generated/protocol.ts",
    import.meta.url,
  );
  writeFileSync(fileURLToPath(generatedUrl), source);

  // Imported via a runtime URL value, not a literal specifier: the file doesn't exist until the writeFileSync above creates it, so tsc must not try to statically resolve it (a literal "./fixtures/generated/protocol.ts" specifier fails typecheck on a clean checkout, before any test run has ever generated the file).
  const imported: unknown = await import(generatedUrl.href);
  if (!isGeneratedSchemas(imported)) {
    throw new Error(
      "generated module is missing frameSchema/capabilityTokenSchema",
    );
  }
  schemas = imported;
});

function roundTrip(
  vector: Readonly<Vector>,
  schema: GeneratedSchemas["frameSchema"],
): void {
  // A plain Uint8Array, not a Node Buffer: cbor2 slices embedded byte strings via the input's own subarray(), which on a Buffer returns another Buffer -- a constructor cbor2's encoder doesn't recognise as a byte string when it comes time to re-encode, producing a garbled {type, data} map instead (the same gotcha conformance/codec.ts documents for the reverse direction).
  const bytes = Uint8Array.from(Buffer.from(vector.wire_hex, "hex"));
  const decoded: unknown = decode(bytes, cdeDecodeOptions);

  const result = schema.safeParse(decoded);
  expect(result.success, `schema rejected vector "${vector.name}"`).toBe(true);

  const reEncoded = Buffer.from(encode(result.data, cdeEncodeOptions)).toString(
    "hex",
  );
  expect(
    reEncoded,
    `re-encoding "${vector.name}" did not reproduce wire_hex`,
  ).toBe(vector.wire_hex);
}

describe("frame vectors decode and re-encode byte-exactly through frameSchema", () => {
  for (const vector of [
    ...readVectors("frames.v1.json"),
    ...readVectors("handshake.v1.json"),
  ]) {
    it(vector.name, () => {
      roundTrip(vector, schemas.frameSchema);
    });
  }
});

describe("token vectors decode and re-encode byte-exactly through capabilityTokenSchema", () => {
  for (const vector of readVectors("tokens.v1.json")) {
    it(vector.name, () => {
      roundTrip(vector, schemas.capabilityTokenSchema);
    });
  }
});
