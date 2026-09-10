# Decision 0001: the code-generation foundation

Status: accepted (2026-09-10)

## Context

cddl.js's original plan (see git history of the README) was to compile the Rust [`cddl`](https://github.com/anweiss/cddl) crate to WebAssembly and drive a TypeScript-side Zod emitter off its AST. That plan was premised on "no TypeScript CDDL codegen exists anywhere today." A re-check on 2026-09-10 found the premise stale: [`cddl2ts`](https://www.npmjs.com/package/cddl2ts) (v0.10.1, actively maintained by the maintainer of the [`cddl`](https://www.npmjs.com/package/cddl) npm package, used in production by WebdriverIO for the WebDriver Bidi specification) generates TypeScript from CDDL today. It emits plain TS interfaces rather than Zod, so cddl.js's output target remains distinct — but the foundation question had to be re-evaluated from scratch.

The evaluation below was run directly against wire-mesh's real, CI-validated schema: `spec/protocol.cddl` from [wire-mesh](https://github.com/ExaDev/wire-mesh) at commit `0665af1` (11 source files, 96 top-level rules, 26 frame variants, sockets, `.size`/`.regexp` control operators, integer map keys, heterogeneous fixed arrays).

## Evaluation findings

### cddl2ts 0.10.1, run over the full spec

Generates 663 lines of commented TypeScript interfaces with exit 0 and no diagnostics. What it gets right: extension sockets become plain unions (`$ManageCommandParams` → `PtySpawn | PtyWrite | ... | ExecList`; `frame = $frame-variant` → `export type Frame = $FrameVariant`), group members flatten into interface fields with correct optionality, named rules become named TS types, and CDDL comments are preserved as JSDoc.

What it drops or gets wrong, all load-bearing for a wire codec:

- **Integer map keys become string-keyed fields.** `cose-token-headers = { ? cose-header-alg => int, ... }` (where `cose-header-alg = 1`) generates `coseHeaderAlg?: number` — a field literally named after the rule. On the wire the key is the integer `1`; a codec consuming this type directly would emit the wrong key.
- **Heterogeneous fixed arrays collapse.** `cose-sign1` — a 4-element array of (bstr, map, bstr/nil, bstr) — generates `export type CoseSign1 = Uint8Array[]`, discarding both the positional structure and the element types.
- **`.size` constraints vanish.** `device-id = bstr .size 32` generates `export type DeviceId = Uint8Array`.
- **Open map tails become `any`.** `* cose-header-label => any` generates `coseHeaderLabel?: any`.
- **No runtime validation.** Interfaces only; nothing that can check a value at a boundary, which is the entire point of Zod output.

### The `cddl` npm parser's AST, inspected directly

The parser cddl2ts is built on retains everything its emitter throws away: `device-id` carries `Operator: { Type: "size", Value: 32 }`; `cose-header-alg` resolves to the literal `Value: 1`; `cose-sign1`'s four elements are present with names, per-element types (including the group reference and the `bstr | nil` choice), and occurrence bounds; socket choice-additions are distinguishable from base definitions.

It has one real gap: **the `.cbor` control operator is not implemented.** The parser's operator table (`OPERATORS_EXPECTING_VALUES` in `build/parser.js`) contains `size`, `regexp`, `bits`, `and`, `within`, `eq`, `ne`, `lt`, `le`, `gt`, `ge`, `default` — and no `cbor`. Feeding it `envelope = [ bstr .cbor claims, bstr ]` does not produce a parse error; it crashes the parser with an internal `TypeError: Cannot read properties of undefined (reading 'join')`. wire-mesh's current schema passes this parser only because every `.cbor` relationship in it is written as a `;` comment rather than an actual operator.

## Options considered

**A. Extend the pure-JS `cddl` parser and write a new Zod emitter on its AST.** The AST already carries everything needed except `.cbor`; the gap is a bounded addition to one operator table plus wiring the operator's target type as a type-identified byte string. cddl2ts's emitter walk serves as a working reference for the AST's shapes. No new toolchain. The parser is the same one wire-mesh's CI already validates its schema with, so spec validity and codegen input stay locked to one implementation. Parser changes are upstreamable (the package is actively maintained); a fork is the fallback if upstreaming stalls.

**B. The original WASM plan: compile the Rust `cddl` crate.** Full RFC 8610 support including `.cbor`, but it adds a WASM build target to every consumer's toolchain, and the load-bearing question — whether the crate's AST serialises cleanly across the boundary — was never verified. The Rust crate is already the planned validation path for wire-mesh's `rust/` implementation, so the two-parser consistency question (spec valid under one parser, generated from another) also arises here.

**C. Keep `.cbor` in comments and hardcode the known nestings in the emitter.** Cheapest today, but it makes the schema's comments load-bearing machine data and quietly breaks the single-source-of-truth property the whole project exists to provide. Rejected.

## Decision

**Option A.** cddl.js is built on the pure-JS [`cddl`](https://www.npmjs.com/package/cddl) parser's AST, extended to implement the `.cbor` control operator, with cddl.js's own new emitter generating Zod schemas (inferred type plus runtime validator from one generation step, per the standing single-source-of-truth convention).

Consequences:

- The parser extension is attempted upstream first; a vendored fork is the fallback. Either way cddl.js pins the exact parser revision it was built and tested against.
- Once the patched parser validates it, wire-mesh's `spec/*.cddl` upgrade their five `.cbor` relationships from comments to real operators (three in `tokens.cddl`, one each in `federation.cddl` and `discovery.cddl`), making the nesting machine-readable in the schema itself. The Rust `cddl` crate already supports `.cbor`, so wire-mesh's cross-validation path is unaffected.
- The WASM/Rust foundation is retired; the serde-serialisability question that plan left open is moot.
- The README's "genuinely unaddressed territory" claim is corrected: cddl2ts exists, generates TS interfaces, and cddl.js's distinct contribution is the Zod output plus a parser that implements the operator its schema actually needs.

## Verification of the claims above

All findings were reproduced from a scratch checkout: `cddl2ts@0.10.1` and `cddl@0.21.1` installed from npm, run against the committed `spec/protocol.cddl`, with the AST inspected via the parser's programmatic `parse()` API and the operator table read from the installed `build/parser.js` source. The `.cbor` crash reproduces on both an array member and a map member.
