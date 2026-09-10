# Decision 0002: foundation spike — outcome confirmed

Status: accepted (2026-09-10)

## Question

Can the pure-JS [`cddl`](https://www.npmjs.com/package/cddl) parser, with the `.cbor` extension from [0001-foundation.md](0001-foundation.md), parse wire-mesh's real 96-rule schema end to end with a `.cbor` relationship promoted from comment to actual operator — and produce an AST a Zod emitter can consume?

## What was done

Cloned [webdriverio/cddl](https://github.com/webdriverio/cddl) (the parser's source monorepo), applied a three-part patch to `packages/cddl/src` (kept as [spike/cddl-cbor-operator.patch](../spike/cddl-cbor-operator.patch), 9 changed lines), rebuilt, and tested:

1. **Operator tables** — added `cbor` and `cborseq` to `OperatorType` (`ast.ts`), the `OPERATORS` gate list, and `OPERATORS_EXPECTING_VALUES` (`parser.ts`). The existing `parseOperator` machinery needs no further change: it already parses the operator's value as a generic property type, which is exactly right — `.cbor`'s value is a type reference.
2. **Guarded an unguarded `parseOperator()` call** (`parser.ts`, the `groupName` path of `parseAssignmentValue`'s single-type branch) that fired spuriously when no operator was present. This was the actual cause of the original "crash on `.cbor`" — the error path itself crashed (`OPERATORS_EXPECTING_VALUES[type].join` with `type` undefined) before it could report anything.
3. **Made that error message non-crashing** for genuinely unknown operators, so future gaps report properly instead of throwing a `TypeError`.

Then promoted `token-claims`' `parent` field in wire-mesh's `tokens.cddl` from `? parent: bstr, ; bstr .cbor capability-token ...` to `? parent: bstr .cbor capability-token` and parsed the full concatenated spec.

## Result

**The foundation is confirmed.** The full spec — all 96 rules including the promoted operator — parses cleanly, and the AST for the promoted field is exactly what a Zod emitter needs:

```json
{ "Type": "bstr", "Operator": { "Type": "cbor", "Value": { "Type": "group", "Value": "capability-token" } } }
```

The nested type reference is machine-readable; nothing is lost to comments.

All 427 upstream tests across the monorepo's 41 test files still pass. The only CI complaint is a coverage-threshold dip (branches 92.36% vs the 93% gate) because the new code paths have no tests yet — the real upstream PR adds `.cbor`/`.cborseq` test cases, which the spike deliberately did not.

## Pre-existing upstream bug found (not `.cbor`-specific)

**Operators in array-member position crash the parser.** `[ bstr .size 3, bstr ]` — an *existing, supported* operator — fails identically on the unpatched npm 0.21.1 build, so this is not caused by the patch. With the patch, `.cbor` in array-member position gets past the first crash into a second one: after an operator value inside an array member, token consumption desynchronises (`group identifier expected` on the following member). Two of wire-mesh's `.cbor` relationships live in exactly this position — `cose-sign1`'s `protected` and `payload` members — so those two stay comment-form until this second bug is fixed upstream (or in the fork). It is the one remaining piece of parser work between here and a fully machine-readable spec; map-member and top-level positions (the other three relationships, including the delegation chain's `parent`) already work.

## Spike false alarm, recorded for honesty

An earlier full-spec parse appeared to hang; investigation showed the concatenated test file had grown to 32 GB — the concatenation shell loop's `*.cddl` glob had matched the output file itself, so `cat` appended the file to itself forever. The parser was never hanging. Any future "parser hangs on big input" claim from this spike should be read in that light: it doesn't.

## Consequences

- Task order for the build (see the repository README's chosen approach) stands: upstream PR with the patch plus tests for the new operators first; vendored fork as fallback; wire-mesh spec promotes its `.cbor` relationships as each position becomes supported.
- The array-member operator bug goes into the upstream PR too (or a sibling PR), since `[ bstr .size 3, bstr ]` crashing is a plain upstream defect independent of `.cbor`.
