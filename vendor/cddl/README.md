# vendor/cddl/

A vendored copy of [webdriverio/cddl](https://github.com/webdriverio/cddl)'s `packages/cddl/src` (the CDDL parser this project's [foundation decision](../../docs/0001-foundation.md) is built on), MIT-licensed, unmodified except for four upstream fixes cddl.js needs that aren't released yet:

- `fix: operators on array members no longer crash the parser` -- [webdriverio/cddl#88](https://github.com/webdriverio/cddl/pull/88), needs a maintainer to sign the project's EasyCLA before it can merge.
- `feat: add .cbor and .cborseq control operators` -- stacked on the above, tracking [webdriverio/cddl#89](https://github.com/webdriverio/cddl/issues/89), PR at [Mearman/cddl#1](https://github.com/Mearman/cddl/pull/1).
- `fix: ? occurrence indicator no longer parses as unbounded` -- stacked on the above two, tracking [webdriverio/cddl#90](https://github.com/webdriverio/cddl/issues/90), PR at [Mearman/cddl#2](https://github.com/Mearman/cddl/pull/2). `?` and `*` shared the same default upper bound (`Infinity`), so an arrow-syntax entry keyed by a rule reference (`? cose-header-alg => int`) and the generic open-map-tail pattern (`* tstr => any`) parsed with an identical occurrence, making them indistinguishable -- found while generating Zod schemas against wire-mesh's real `cose-token-headers` rule.
- `fix: resolve backslash-escaped characters in string literals` -- tracking [webdriverio/cddl#91](https://github.com/webdriverio/cddl/issues/91), PR at [Mearman/cddl#92](https://github.com/webdriverio/cddl/pull/92) (branch `fix/string-literal-escape-sequences` on the fork). `readString()` returned a text-string literal's raw source slice with no RFC 8610 SESC escape processing, so a `.regexp` value carrying an escaped backslash (`\\.`, `\\+`) kept an extra literal backslash all the way into the emitted `new RegExp(...)` call -- found generating wire-mesh's `dm-room-path` rule, and confirmed to already affect the already-shipped `namespaced-domain-id` rule too.

All four are recorded in full, with their own test coverage, in [docs/0002-spike.md](../../docs/0002-spike.md) and the commits on [Mearman/cddl](https://github.com/Mearman/cddl) (`fix/array-member-operators`, `feat/cbor-operator`, `fix/optional-occurrence-defaults-to-one`, `fix/string-literal-escape-sequences`).

## Why vendored, not a dependency

cddl.js's foundation decision commits to attempting the fix upstream first, with a vendored fork as the fallback -- not because upstreaming failed, but because it needs a maintainer's action (the CLA) this project has no control over the timing of, and cddl.js's own work (the actual point of this repository) shouldn't block on that.

## Removing this once upstream ships

Once webdriverio/cddl#88, the `.cbor` PR, the `?` occurrence-indicator fix, and #92 all merge and a release goes out:

1. Delete this directory.
2. Add `cddl` as an ordinary npm dependency instead.
3. Update the one import site (`src/parse.ts`) from `../vendor/cddl/src/index.js` to `cddl`.
4. Delete this README and the two decision-record entries' "vendored, not yet upstream" framing (the decisions themselves -- pure-JS foundation, the two operator fixes -- don't change; only where the code lives does).
