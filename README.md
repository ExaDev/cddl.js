# cddl.js

[![GitHub](https://img.shields.io/badge/GitHub-181717?logo=github&logoColor=white)](https://github.com/ExaDev/cddl.js) [![npm](https://img.shields.io/badge/npm-CB3837?logo=npm&logoColor=white)](https://www.npmjs.com/package/cddl.js) [![Release](https://img.shields.io/github/v/release/ExaDev/cddl.js)](https://github.com/ExaDev/cddl.js/releases/latest) [![CI](https://img.shields.io/github/actions/workflow/status/ExaDev/cddl.js/ci.yml?branch=main)](https://github.com/ExaDev/cddl.js/actions)

Generates [Zod](https://zod.dev) schemas, and the TypeScript types inferred from them, from [CDDL](https://datatracker.ietf.org/doc/html/rfc8610).

[![npm downloads chart, log scale](https://shieldcn.dev/chart/npm/cddl.js.svg?bg=transparent&logo=false&yScale=log)](https://www.npmjs.com/package/cddl.js)

CDDL (RFC 8610) is the IETF standard for describing CBOR and JSON data structures. JavaScript and TypeScript have a CDDL parser ([`cddl`](https://www.npmjs.com/package/cddl)) and a TypeScript-interface generator ([`cddl2ts`](https://www.npmjs.com/package/cddl2ts)), but an interface has no runtime validator, so the two drift apart as soon as one changes without the other. cddl.js takes a CDDL file and emits one TypeScript module in which every named rule becomes a Zod schema and an inferred type, so the type and the validator come from a single generation step.

It supports a deliberately scoped subset of CDDL, not all of RFC 8610. Anything outside that subset throws an error naming the construct and the rule it appeared in, rather than emitting something wrong.

## Installing

```sh
npm install cddl.js zod
```

The package is [`cddl.js`](https://www.npmjs.com/package/cddl.js) on npm. `zod` is a peer dependency, supported at `>=4.0.0 <5` (zod 5 and above are excluded until tested): install it in the project that uses cddl.js, so that the generated modules and `cddl.js/runtime` build and run schemas with one copy. The suite runs against the lowest and the latest 4.x in CI. A package manager that does not install peer dependencies by itself leaves zod missing, which shows as a module-not-found error for `zod` on import.

## Usage

Given a CDDL file:

```cddl
person = {
  name: tstr,
  age: uint,
  ? email: tstr,
  id: bstr .size 4,
}
```

parse it, emit the module and write it out:

```js
import { writeFileSync } from "node:fs";
import { parse } from "cddl.js/parse";
import { emitModule } from "cddl.js/emitter";

const source = emitModule(parse("person.cddl"));
writeFileSync("person.generated.ts", source);
```

The generated module is, after a header comment saying it is generated and should not be edited by hand:

```ts
import { z } from "zod";

export const personSchema = z.lazy(() => z.object({
  "name": z.string(),
  "age": z.number().int().nonnegative(),
  "email": z.string().optional(),
  "id": z.instanceof(Uint8Array).refine((v) => v.length === 4, { message: "expected exactly 4 bytes" }),
}));

export type Person = z.infer<typeof personSchema>;
```

Use it like any other Zod schema:

```ts
import { personSchema, type Person } from "./person.generated.ts";

const ok: Person = personSchema.parse({ name: "Ada", age: 36, id: new Uint8Array(4) });
console.log(ok);
// { name: 'Ada', age: 36, id: Uint8Array(4) [ 0, 0, 0, 0 ] }

console.log(personSchema.safeParse({ name: "Ada", age: -1, id: new Uint8Array(3) }).success);
// false
```

## Entry points

The package has no root export. Each module is imported by its own subpath, and each resolves under both `import` and `require`. The CommonJS build is self-contained and does not rely on `require()` of ES modules.

| Subpath | Export | Purpose |
| --- | --- | --- |
| `cddl.js/parse` | `parse(filePath: string): unknown` | Parses a CDDL file into an AST. The result is typed `unknown` on purpose: the AST shape belongs to the vendored parser and is not part of this package's contract. |
| `cddl.js/emitter` | `emitModule(parsed: unknown): string` | Compiles a parsed AST into the source of one TypeScript module. |
| `cddl.js/emitter` | `mergeRules(parsed: unknown): MergedRule[]` | Groups the top-level rules by name, merging a socket's `/=` additions into one entry. `emitModule` calls it first. |
| `cddl.js/runtime` | `cborDecodesAs(schema: z.ZodType): z.ZodType<Uint8Array>` | Support code that generated modules import when the CDDL uses `.cbor` or `.cborseq`. |

## What a generated module contains

Each named rule produces two exports: `<name>Schema` and `<Name>`, the camel-cased and Pascal-cased rule name with any leading `$` removed (`$frame-variant` becomes `frameVariantSchema` and `FrameVariant`). Every schema is wrapped in `z.lazy`, so rules can reference each other in any order. A rule that can reach itself through such references carries an explicit `z.ZodType` annotation, because TypeScript cannot infer a type through a cycle. Every other rule's type is inferred from its own expression.

## Supported CDDL

| CDDL | Generated |
| --- | --- |
| `tstr`, `bstr` | `z.string()`, `z.instanceof(Uint8Array)` |
| `int`, `uint`, `nint` | `z.number().int()`, with `.nonnegative()` for `uint` and `.negative()` for `nint` |
| `bool`, `nil`, `null`, `any` | `z.boolean()`, `z.null()`, `z.null()`, `z.unknown()` |
| Literal values | `z.literal(...)` |
| Map `{ ... }` | `z.object({ ... })`, also as an inline value type |
| `key: type` | A required field, or an optional one with `?` |
| `* keytype => type` | The map's catch-all: `.catchall(type)`. One per map. |
| `? name => type`, where `name = <literal>` is a rule | A field keyed by the literal's string form, so an integer key `1` becomes `"1"` |
| `[* type]` | `z.array(type)` |
| `[a, b, c]` | `z.tuple([a, b, c])`, preserving each position's own type |
| `a / b` | `z.union([a, b])` |
| Reference to another rule | `z.lazy(() => otherSchema)` |
| `$name = x` with `$name /= y` additions | One schema that is the union of every definition |
| `.size N` | The value's `length` must equal `N` exactly |
| `.regexp "..."` | `.regex(new RegExp("^(?:...)$", "u"))`: the pattern must match the whole string, as RFC 8610 section 3.8.3 requires. An operand that is not a valid pattern under the `u` flag throws at generation, naming the rule. The operand is JavaScript regular expression syntax, not XSD: `.` excludes every JavaScript line terminator (LF, CR, U+2028, U+2029) where XSD excludes only LF and CR, and XSD-only escapes (`\i`, `\c`, block names such as `\p{IsBasicLatin}`) and character class subtraction are not translated. Under the `u` flag some operands that are valid without it fail at generation: an identity escape outside a class (`\-`, `\_`), a lone `{`, and a class range with a shorthand end (`[\d-z]`) |
| `.cbor rule`, `.cborseq rule` | `cborDecodesAs(...)`, described below |

Anything else throws. That includes other native types such as `float`, occurrence indicators other than none, `?` and `*` (so `+` and `n*m` are rejected), more than one catch-all in a map, any occurrence indicator on a fixed array's members, other control operators, and a rule defined more than once without being a socket.

### `.cbor` and the runtime module

`bstr .cbor rule` generates a byte-string field whose contents must decode as CBOR and match the named rule. This is how nested payloads, such as the fields of a COSE envelope, are described. The field's value stays the original bytes: `cborDecodesAs` validates the embedded CBOR without transforming it, so decoding, validating and re-encoding reproduces the identical wire bytes. A caller that wants the inner value decodes it separately.

A module that uses `.cbor` imports `cborDecodesAs` from `./runtime.js`, a sibling of the generated file, so provide a module of that name next to it:

```ts
// runtime.ts
export { cborDecodesAs } from "cddl.js/runtime";
```

## Development

Tool versions are pinned in `.tool-versions`. Tasks run through Turborepo and have the same names as the scripts in `package.json`:

```sh
pnpm install
pnpm build       # bundles the three entry points, with declarations, and checks them with attw
pnpm test        # unit and round-trip tests
pnpm lint
pnpm typecheck
```

The parser is a vendored copy of [webdriverio/cddl](https://github.com/webdriverio/cddl) in [`vendor/cddl`](vendor/cddl/README.md), carrying fixes that have not yet been released upstream. The tasks above build it first; run `pnpm vendor:build` yourself before running a script that imports it directly.

The round-trip test generates schemas from a real-world CDDL specification in `test/fixtures`, then checks that every recorded conformance vector decodes, validates and re-encodes to its original bytes. The fixtures are described in [`test/fixtures/README.md`](test/fixtures/README.md).

From a checkout, `node src/cli.ts <input.cddl> <output.ts>` runs the same parse and emit steps on one file. The command line script is not part of the published package.

## Background

cddl.js was built for [wire-mesh](https://github.com/ExaDev/wire-mesh), which needs a TypeScript implementation of a CDDL-described wire protocol, but it is scoped and named to stand on its own. The decisions behind it, including why it builds on the pure-JavaScript `cddl` parser's AST with an emitter of its own, are recorded in [docs/0001-foundation.md](docs/0001-foundation.md) and [docs/0002-spike.md](docs/0002-spike.md).

## Contributing

Issues and pull requests are welcome. If you know of CDDL tooling for JavaScript or TypeScript that this README does not mention, please open an issue.

## Licence

MIT, see [LICENSE](LICENSE). The vendored parser is MIT licensed by WebdriverIO, see [`vendor/cddl/LICENSE`](vendor/cddl/LICENSE).
