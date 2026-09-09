# cddl.js

CDDL support for TypeScript and JavaScript. [CDDL](https://datatracker.ietf.org/doc/html/rfc8610) (RFC 8610) is the IETF standard for describing CBOR and JSON data structures — Rust has real tooling for it; JavaScript and TypeScript, as far as we've been able to find, currently do not.

> Status: **planning phase**. Nothing here is implemented yet. This repository records the intended approach ahead of a first release.

## What it will do

Take a CDDL schema and generate [Zod](https://zod.dev) schemas from it, so a TypeScript consumer gets both the inferred type and the runtime validator from one generation step — rather than a bare `interface` with no matching validator, which drifts the moment either side changes without the other.

## Why this exists

Built first to serve [wire-mesh](https://github.com/ExaDev/wire-mesh)'s own need for a TypeScript implementation of a CDDL-described wire protocol, but scoped and named to stand on its own: CDDL-to-TypeScript code generation appears to be genuinely unaddressed territory today, not a crowded space with an obvious existing choice.

## Planned approach

- **Reuse the Rust [`cddl`](https://github.com/anweiss/cddl) crate's parser rather than writing a new one.** Parsing CDDL's grammar correctly — generics, control operators, extension sockets — is the hard, easy-to-get-subtly-wrong part of a tool like this, and an actively maintained implementation already exists. The plan is to compile that crate (or a thin AST-exposing wrapper around it) to `wasm32-unknown-unknown` and drive a TypeScript-side code emitter off its already-correct parse tree, rather than reimplementing parsing from scratch. Whether the crate's AST types are cleanly serialisable across the WASM boundary (for example via `serde`) is a concrete question to verify before committing further to this approach — not yet confirmed.
- **Support a deliberately scoped subset of CDDL, not full RFC 8610 compliance**, documented explicitly, erroring clearly and loudly on anything outside that subset rather than silently mishandling it.
- **Emit Zod schemas as the generation target**, not bare TypeScript interfaces or types.

## Prior art considered

[BARE](https://datatracker.ietf.org/doc/draft-devault-bare/) already has a working TypeScript code generator, [`bare-ts/bare`](https://github.com/bare-ts/bare) — closing the exact gap this project targets, but for a different, and currently still-draft (not yet a finalised RFC), wire format. If wire-mesh had chosen BARE over CBOR/CDDL, this project would likely not need to exist.

## Contributing

Too early for code contributions to be useful yet. If you've built CDDL tooling for JavaScript or TypeScript that we've missed, please open an issue — that's the most valuable thing anyone could tell us right now.
