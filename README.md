# cddl.js

CDDL support for TypeScript and JavaScript.

> Status: **planning phase**. Nothing here is implemented yet. This repository records the intended approach ahead of a first release.

## What it will do

[CDDL](https://datatracker.ietf.org/doc/html/rfc8610) (RFC 8610) is the IETF standard for describing CBOR and JSON data structures. Rust has real tooling for it. JavaScript and TypeScript have a parser ([`cddl`](https://www.npmjs.com/package/cddl)) and a TypeScript-interface generator ([`cddl2ts`](https://www.npmjs.com/package/cddl2ts), used in production by WebdriverIO) — but nothing that generates runtime validation.

This project takes a CDDL schema and generates [Zod](https://zod.dev) schemas from it, so a TypeScript consumer gets both the inferred type and the runtime validator from one generation step. That replaces a bare `interface` with no matching validator, which drifts the moment either side changes without the other.

## Why this exists

This project exists to serve [wire-mesh](https://github.com/ExaDev/wire-mesh)'s own need for a TypeScript implementation of a CDDL-described wire protocol — specifically, generating the schemas `ts/packages/core` in that repository is built against, from `spec/protocol.cddl` — but it is scoped and named to stand on its own. TypeScript codegen for CDDL is not unaddressed territory (cddl2ts addresses it); runtime-validation codegen is.

## Chosen approach

Recorded in full, with the evaluation evidence behind it, in [docs/0001-foundation.md](docs/0001-foundation.md). In brief:

- **Build on the pure-JS `cddl` parser's AST**, extended to implement the `.cbor` control operator it currently lacks (it crashes rather than parsing `bstr .cbor t` — a gap that matters because nested byte strings are how COSE envelopes wrap their payloads). The extension is attempted upstream first; a vendored fork is the fallback.
- **Write a new Zod emitter** over that AST. cddl2ts's emitter demonstrates the AST's shapes but drops things a wire codec cannot afford: integer map keys become string-keyed fields, heterogeneous fixed arrays collapse to homogeneous ones, `.size` constraints vanish, and open map tails become `any`.
- **Support a deliberately scoped subset of CDDL, not full RFC 8610 compliance.** Document that subset explicitly, and error clearly and loudly on anything outside it rather than silently mishandling it.

## Prior art considered

- [`cddl2ts`](https://www.npmjs.com/package/cddl2ts) — TypeScript interfaces from CDDL, actively maintained, production-used. Evaluated directly against wire-mesh's schema (see the decision record); its AST walk is a useful reference, its output target (bare interfaces) and its information loss (integer keys, array heterogeneity, size constraints) are what cddl.js exists to fix.
- The Rust [`cddl`](https://github.com/anweiss/cddl) crate compiled to WASM — the original plan for this repository, retired in favour of the pure-JS foundation; the reasoning is in the decision record.
- [BARE](https://datatracker.ietf.org/doc/draft-devault-bare/) already has a working TypeScript code generator, [`bare-ts/bare`](https://github.com/bare-ts/bare), closing the exact gap this project targets, but for a different, and currently still-draft (not yet a finalised RFC), wire format. If wire-mesh had chosen BARE over CBOR/CDDL, this project would likely not need to exist.

## Why dist/ is committed

Consumers install this package as a git dependency (it isn't published to npm), and pnpm/npm run a git dependency's own build only from inside a `node_modules/` checkout -- exactly the one path Node's native TypeScript-stripping refuses to run, since it deliberately won't process a `.ts` file whose resolved path is under `node_modules`. Committing `dist/` means a git-dependency install never needs to build anything at all: it gets already-built output straight from the checkout, so that restriction never comes up, and the build config can stay a real `.ts` file for everyone actually working on this repo. CI rebuilds from source on every push and fails if the result doesn't match what's committed, so `dist/` can't silently drift from `src/`.

## Contributing

Too early for code contributions to be useful yet. If you have built CDDL tooling for JavaScript or TypeScript that we have missed, please open an issue. That is the most valuable thing anyone could tell us right now.
