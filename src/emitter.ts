// Walks a parsed CDDL AST (from vendor/cddl) and emits TypeScript source defining a Zod schema per named rule, plus its inferred type. Scoped deliberately to the CDDL subset wire-mesh's spec/*.cddl actually uses -- documented in README.md -- not full RFC 8610. Anything outside that subset throws a clear error naming the unsupported construct and the rule it appeared in, rather than silently emitting something wrong.

import camelCase from "camelcase";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// `Array.isArray`'s lib.es5.d.ts signature is `(arg: any) => arg is any[]`, so guarding an `unknown` with it narrows to `any[]`, not `unknown[]` -- indexing the result then silently produces `any`. This wrapper narrows to `unknown[]` instead, so every element access downstream still requires its own explicit check.
function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isRawRule(value: unknown): value is { Type: string; Name: string } {
  return (
    isPlainObject(value) &&
    typeof value.Type === "string" &&
    typeof value.Name === "string"
  );
}

interface OccurrenceShape {
  n: number;
  m: number;
}

function isOccurrence(value: unknown): value is OccurrenceShape {
  return (
    isPlainObject(value) &&
    typeof value.n === "number" &&
    typeof value.m === "number"
  );
}

interface LiteralValueNode {
  Type: string;
  Value: unknown;
}

function isLiteralValueNode(value: unknown): value is LiteralValueNode {
  return (
    isPlainObject(value) && typeof value.Type === "string" && "Value" in value
  );
}

/** A named rule, after socket (`$name /= X`) choice-additions for the same name have been merged into one combined union. A socket's own entries can mix AST kinds -- e.g. `$manage-command-params = {* tstr => any}` (a group) extended by `$manage-command-params /= pty-spawn / ...` (a variable union of group references) -- so `raw` carries each entry's own kind rather than one shared kind for the whole rule; emitEntryExpr dispatches per entry. `raw` is a non-empty tuple type -- mergeRules never produces a MergedRule without at least one entry -- so callers can index `raw[0]` without an undefined check. */
interface MergedRule {
  name: string;
  isSocket: boolean;
  raw: [Record<string, unknown>, ...Record<string, unknown>[]];
}

export function mergeRules(parsed: unknown): MergedRule[] {
  if (!isUnknownArray(parsed)) {
    throw new Error("expected parse() to return an array of top-level rules");
  }

  const byName = new Map<string, MergedRule>();
  for (const entry of parsed) {
    if (!isRawRule(entry)) {
      throw new Error(
        `unrecognised top-level parse() entry: ${JSON.stringify(entry)}`,
      );
    }
    if (
      entry.Type !== "group" &&
      entry.Type !== "array" &&
      entry.Type !== "variable"
    ) {
      throw new Error(
        `unsupported top-level rule kind "${entry.Type}" for rule "${entry.Name}"`,
      );
    }

    const existing = byName.get(entry.Name);
    if (existing) {
      if (!existing.isSocket) {
        throw new Error(
          `rule "${entry.Name}" is defined more than once, outside cddl.js's supported subset (only a socket name, "$name /= X", may have multiple definitions)`,
        );
      }
      existing.raw.push(entry);
      continue;
    }

    byName.set(entry.Name, {
      name: entry.Name,
      isSocket: entry.Name.startsWith("$"),
      raw: [entry],
    });
  }

  return [...byName.values()];
}

function schemaVarName(ruleName: string): string {
  const clean = ruleName.startsWith("$") ? ruleName.slice(1) : ruleName;
  return `${camelCase(clean)}Schema`;
}

function typeName(ruleName: string): string {
  const clean = ruleName.startsWith("$") ? ruleName.slice(1) : ruleName;
  return camelCase(clean, { pascalCase: true });
}

function requireStringField(
  obj: Record<string, unknown>,
  key: string,
  ruleName: string,
): string {
  const value = obj[key];
  if (typeof value !== "string") {
    throw new Error(
      `rule "${ruleName}" is missing the expected "${key}" string field`,
    );
  }
  return value;
}

function requireObjectField(
  obj: Record<string, unknown>,
  key: string,
  ruleName: string,
): Record<string, unknown> {
  const value = obj[key];
  if (!isPlainObject(value)) {
    throw new Error(
      `rule "${ruleName}" is missing the expected "${key}" field`,
    );
  }
  return value;
}

function emitOccurrence(
  occurrence: unknown,
  inner: string,
  ruleName: string,
): { expr: string; optional: boolean } {
  if (!isOccurrence(occurrence)) {
    throw new Error(
      `rule "${ruleName}" has a member with an unrecognised Occurrence`,
    );
  }
  const { n, m } = occurrence;
  if (n === 1 && m === 1) {
    return { expr: inner, optional: false };
  }
  if (n === 0 && m === Infinity) {
    return { expr: inner, optional: true };
  }
  if (n === 0 && m === 1) {
    return { expr: `${inner}.optional()`, optional: false };
  }
  throw new Error(
    `rule "${ruleName}" uses an occurrence indicator (n=${String(n)}, m=${String(m)}) outside cddl.js's supported subset (?, required, or unbounded *)`,
  );
}

function emitOperatorValue(
  operator: Record<string, unknown>,
  ruleName: string,
): string {
  const opValue = operator.Value;
  if (isLiteralValueNode(opValue) && opValue.Type === "literal") {
    return JSON.stringify(opValue.Value);
  }
  throw new Error(
    `rule "${ruleName}" uses an unsupported operator value shape`,
  );
}

/** Rule names a rule's own emitted expression references via `z.lazy(() => xSchema)` -- collected as emission walks the AST so emitModule can tell which rules are genuinely part of a reference cycle afterwards (see computeCyclicRules). */
type RefSet = Set<string>;

function emitWithOperator(
  node: Record<string, unknown>,
  ruleName: string,
  refs: RefSet,
): string {
  const baseType = node.Type;
  const operator = requireObjectField(node, "Operator", ruleName);
  const operatorType = operator.Type;

  let baseExpr: string;
  if (typeof baseType === "string") {
    baseExpr = emitNativeType(baseType, ruleName);
  } else if (
    isPlainObject(baseType) &&
    baseType.Type === "group" &&
    typeof baseType.Value === "string"
  ) {
    refs.add(baseType.Value);
    baseExpr = `z.lazy(() => ${schemaVarName(baseType.Value)})`;
  } else {
    throw new Error(
      `rule "${ruleName}" has an operator attached to an unsupported base type`,
    );
  }

  if (operatorType === "size") {
    const opValue = operator.Value;
    if (
      !isLiteralValueNode(opValue) ||
      opValue.Type !== "literal" ||
      typeof opValue.Value !== "number"
    ) {
      throw new Error(
        `rule "${ruleName}" uses .size with a non-literal-integer value, outside cddl.js's supported subset`,
      );
    }
    const size = opValue.Value;
    return `${baseExpr}.refine((v) => v.length === ${String(size)}, { message: "expected exactly ${String(size)} bytes" })`;
  }

  if (operatorType === "regexp") {
    const pattern = emitOperatorValue(operator, ruleName);
    return `${baseExpr}.regex(new RegExp(${pattern}))`;
  }

  if (operatorType === "cbor" || operatorType === "cborseq") {
    const opValue = operator.Value;
    if (
      !isPlainObject(opValue) ||
      opValue.Type !== "group" ||
      typeof opValue.Value !== "string"
    ) {
      throw new Error(
        `rule "${ruleName}" uses .cbor/.cborseq with a value that isn't a plain rule reference, outside cddl.js's supported subset`,
      );
    }
    refs.add(opValue.Value);
    const innerVar = schemaVarName(opValue.Value);
    return `cborDecodesAs(z.lazy(() => ${innerVar}))`;
  }

  throw new Error(
    `rule "${ruleName}" uses unsupported operator ".${String(operatorType)}"`,
  );
}

function emitNativeType(name: string, ruleName: string): string {
  switch (name) {
    case "bstr":
      return "z.instanceof(Uint8Array)";
    case "tstr":
      return "z.string()";
    case "int":
      return "z.number().int()";
    case "uint":
      return "z.number().int().nonnegative()";
    case "nint":
      return "z.number().int().negative()";
    case "bool":
      return "z.boolean()";
    case "any":
      return "z.unknown()";
    case "nil":
    case "null":
      return "z.null()";
    default:
      throw new Error(
        `rule "${ruleName}" uses native type "${name}", outside cddl.js's supported subset`,
      );
  }
}

/** Resolves a rule name to the single literal value it's an alias for (e.g. `cose-header-alg = 1` resolves "cose-header-alg" to `1`) -- built once per emitModule call and threaded through every emit* function that walks into a map's properties, since an arrow-syntax map entry keyed by such a name (`? cose-header-alg => int`) must use the literal's own wire value as the object key, not the rule's name (wire-mesh's codec decodes an integer-keyed CBOR map to a plain object keyed by String(n), confirmed against conformance/codec.ts's fromWire). */
type LiteralKeyMap = ReadonlyMap<string, string | number>;

function buildLiteralKeyMap(rules: readonly MergedRule[]): LiteralKeyMap {
  const map = new Map<string, string | number>();
  for (const rule of rules) {
    if (rule.raw.length !== 1) continue;
    const entry = rule.raw[0];
    if (entry.Type !== "variable") continue;
    const propertyType = entry.PropertyType;
    if (!isUnknownArray(propertyType) || propertyType.length !== 1) continue;
    const only = propertyType[0];
    if (
      isLiteralValueNode(only) &&
      only.Type === "literal" &&
      (typeof only.Value === "string" || typeof only.Value === "number")
    ) {
      map.set(rule.name, only.Value);
    }
  }
  return map;
}

function emitSingleType(
  node: unknown,
  ruleName: string,
  literalKeys: LiteralKeyMap,
  refs: RefSet,
): string {
  if (typeof node === "string") {
    return emitNativeType(node, ruleName);
  }
  if (!isPlainObject(node)) {
    throw new Error(
      `rule "${ruleName}" has a property type that isn't a recognised shape: ${JSON.stringify(node)}`,
    );
  }
  if ("Operator" in node) {
    return emitWithOperator(node, ruleName, refs);
  }
  if (node.Type === "literal") {
    return `z.literal(${JSON.stringify(node.Value)})`;
  }
  if (node.Type === "group" && typeof node.Value === "string") {
    refs.add(node.Value);
    return `z.lazy(() => ${schemaVarName(node.Value)})`;
  }
  if (node.Type === "group" && "Properties" in node) {
    // An inline anonymous map used as a property's own value type, e.g. `env: {* tstr => tstr}` -- distinct from the rule-reference shape above, which carries a `Value` name instead of its own `Properties`.
    return emitGroupExpr(node, ruleName, literalKeys, refs);
  }
  if (node.Type === "array") {
    return emitArrayExpr(node, ruleName, literalKeys, refs);
  }
  throw new Error(
    `rule "${ruleName}" has a property type shape outside cddl.js's supported subset: ${JSON.stringify(node)}`,
  );
}

/** A property type is normally an array of branch nodes (one per `/`-separated alternative), but the vendored parser emits a bare node directly -- not array-wrapped -- for an array's own anonymous, single-member value type (confirmed against wire-mesh's real spec: `entries: [* bstr]` produces a bare `"bstr"` where `peers: [* peer-advert]` produces a wrapped `[{Type:"group",...}]`). Both shapes are handled uniformly here. */
function emitPropertyType(
  types: unknown,
  ruleName: string,
  literalKeys: LiteralKeyMap,
  refs: RefSet,
): string {
  if (!isUnknownArray(types)) {
    return emitSingleType(types, ruleName, literalKeys, refs);
  }
  if (types.length === 0) {
    throw new Error(`rule "${ruleName}" has an empty property type`);
  }
  if (types.length === 1) {
    return emitSingleType(types[0], ruleName, literalKeys, refs);
  }
  return `z.union([${types.map((t) => emitSingleType(t, ruleName, literalKeys, refs)).join(", ")}])`;
}

function emitGroupProperties(
  properties: unknown,
  ruleName: string,
  literalKeys: LiteralKeyMap,
  refs: RefSet,
): { fields: string[]; catchall: string | undefined } {
  if (!isUnknownArray(properties)) {
    throw new Error(`rule "${ruleName}" has malformed Properties`);
  }

  const fields: string[] = [];
  let catchall: string | undefined;

  for (const rawProp of properties) {
    if (!isPlainObject(rawProp)) {
      throw new Error(`rule "${ruleName}" has a malformed property entry`);
    }
    const occurrence = rawProp.Occurrence;
    const keyName = requireStringField(rawProp, "Name", ruleName);

    if (rawProp.HasCut === false) {
      // Arrow syntax (`keytype => valuetype`): either a specific literal-valued key (`? cose-header-alg => int`) or the generic open-map-tail (`* tstr => any`).
      const literalKey = literalKeys.get(keyName);
      if (literalKey !== undefined) {
        const inner = emitPropertyType(
          rawProp.Type,
          ruleName,
          literalKeys,
          refs,
        );
        const { expr, optional } = emitOccurrence(occurrence, inner, ruleName);
        fields.push(
          `  ${JSON.stringify(String(literalKey))}: ${optional ? `${expr}.optional()` : expr},`,
        );
        continue;
      }
      if (
        isOccurrence(occurrence) &&
        occurrence.n === 0 &&
        occurrence.m === Infinity
      ) {
        if (catchall !== undefined) {
          throw new Error(
            `rule "${ruleName}" has more than one open-map-tail (* key => value) entry, outside cddl.js's supported subset (one per map)`,
          );
        }
        catchall = emitPropertyType(rawProp.Type, ruleName, literalKeys, refs);
        continue;
      }
      throw new Error(
        `rule "${ruleName}" has an arrow-syntax map entry ("${keyName} => ...") that is neither a known literal-valued key nor the open-tail pattern, outside cddl.js's supported subset`,
      );
    }

    const inner = emitPropertyType(rawProp.Type, ruleName, literalKeys, refs);
    const { expr, optional } = emitOccurrence(occurrence, inner, ruleName);
    fields.push(
      `  ${JSON.stringify(keyName)}: ${optional ? `${expr}.optional()` : expr},`,
    );
  }

  return { fields, catchall };
}

function emitGroupExpr(
  entry: Record<string, unknown>,
  ruleName: string,
  literalKeys: LiteralKeyMap,
  refs: RefSet,
): string {
  const { fields, catchall } = emitGroupProperties(
    entry.Properties,
    ruleName,
    literalKeys,
    refs,
  );
  const object = `z.object({\n${fields.join("\n")}\n})`;
  return catchall !== undefined ? `${object}.catchall(${catchall})` : object;
}

function emitArrayExpr(
  entry: Record<string, unknown>,
  ruleName: string,
  literalKeys: LiteralKeyMap,
  refs: RefSet,
): string {
  const values = entry.Values;
  if (!isUnknownArray(values) || values.length === 0) {
    throw new Error(`rule "${ruleName}" has malformed or empty array Values`);
  }

  // A single, unnamed, unbounded-occurrence member is a homogeneous repeated array: `[* T]`.
  if (values.length === 1) {
    const only = values[0];
    if (isPlainObject(only)) {
      const occurrence = only.Occurrence;
      if (
        only.Name === "" &&
        isOccurrence(occurrence) &&
        occurrence.n === 0 &&
        occurrence.m === Infinity
      ) {
        const inner = emitPropertyType(only.Type, ruleName, literalKeys, refs);
        return `z.array(${inner})`;
      }
    }
  }

  // Otherwise: a fixed, heterogeneous tuple, e.g. cose-sign1's [protected, unprotected, payload, signature].
  const elements = values.map((value) => {
    if (!isPlainObject(value)) {
      throw new Error(`rule "${ruleName}" has a malformed array member`);
    }
    const occurrence = value.Occurrence;
    if (!isOccurrence(occurrence) || occurrence.n !== 1 || occurrence.m !== 1) {
      throw new Error(
        `rule "${ruleName}" mixes occurrence indicators within a fixed array, outside cddl.js's supported subset`,
      );
    }
    return emitPropertyType(value.Type, ruleName, literalKeys, refs);
  });
  return `z.tuple([${elements.join(", ")}])`;
}

/** Emits one raw AST entry's own bare Zod expression (no `z.lazy`/`export const` wrapper), dispatching on that entry's own `Type` -- not the rule's, since a socket's entries can mix kinds (see MergedRule). */
function emitEntryExpr(
  entry: Record<string, unknown>,
  ruleName: string,
  literalKeys: LiteralKeyMap,
  refs: RefSet,
): string {
  const kind = entry.Type;
  if (kind === "group") {
    return emitGroupExpr(entry, ruleName, literalKeys, refs);
  }
  if (kind === "array") {
    return emitArrayExpr(entry, ruleName, literalKeys, refs);
  }
  if (kind === "variable") {
    return emitPropertyType(entry.PropertyType, ruleName, literalKeys, refs);
  }
  throw new Error(
    `rule "${ruleName}" has an unsupported top-level rule kind "${String(kind)}"`,
  );
}

interface RuleExpr {
  expr: string;
  refs: RefSet;
}

/** A rule with exactly one entry emits that entry's own expression directly; a socket with several entries (its base definition plus every `/=` choice-addition) unions every entry's own expression together. */
function computeRuleExpr(
  rule: MergedRule,
  literalKeys: LiteralKeyMap,
): RuleExpr {
  const refs: RefSet = new Set();
  const exprs = rule.raw.map((entry) =>
    emitEntryExpr(entry, rule.name, literalKeys, refs),
  );
  const expr =
    rule.raw.length === 1 ? exprs.join("") : `z.union([${exprs.join(", ")}])`;
  return { expr, refs };
}

/** A rule is "cyclic" if, following z.lazy() references transitively, it can reach itself -- e.g. `frame`'s own union includes `federation-envelope-frame`, whose `inner` field is `.cbor frame`, a reference straight back to `frame`. Only these rules need an explicit `z.ZodType` type annotation to break TypeScript's circular-inference restriction; every other rule can have its schema's concrete shape inferred naturally, which is the entire point of generating Zod schemas with attached inferred types rather than hand-written ones. */
function computeCyclicRules(
  perRule: ReadonlyMap<string, RuleExpr>,
): Set<string> {
  const cyclic = new Set<string>();
  for (const [name, ruleExpr] of perRule) {
    const visited = new Set<string>();
    const stack = [...ruleExpr.refs];
    while (stack.length > 0) {
      const next = stack.pop();
      if (next === undefined || visited.has(next)) continue;
      visited.add(next);
      if (next === name) {
        cyclic.add(name);
        break;
      }
      const nextRefs = perRule.get(next)?.refs;
      if (nextRefs) {
        stack.push(...nextRefs);
      }
    }
  }
  return cyclic;
}

/** Compiles a parsed CDDL AST into a single TypeScript module source: one Zod schema plus one inferred type export per named rule. */
export function emitModule(parsed: unknown): string {
  const rules = mergeRules(parsed);
  const literalKeys = buildLiteralKeyMap(rules);

  const perRule = new Map<string, RuleExpr>();
  for (const rule of rules) {
    perRule.set(rule.name, computeRuleExpr(rule, literalKeys));
  }
  const cyclicRules = computeCyclicRules(perRule);

  const schemaLines: string[] = [];
  const typeLines: string[] = [];
  const needsCbor = JSON.stringify(parsed).includes('"cbor"');

  for (const rule of rules) {
    const ruleExpr = perRule.get(rule.name);
    if (!ruleExpr) {
      throw new Error(
        `internal error: no expression computed for rule "${rule.name}"`,
      );
    }
    // A cyclic rule keeps the generic z.ZodType annotation, since TypeScript can't infer a concrete type through a genuine reference cycle; every other rule infers its own concrete shape from the expression itself, which is what makes the generated `export type X = z.infer<typeof xSchema>` lines actually carry the schema's real shape instead of collapsing to `unknown`.
    const annotation = cyclicRules.has(rule.name) ? ": z.ZodType" : "";
    schemaLines.push(
      `export const ${schemaVarName(rule.name)}${annotation} = z.lazy(() => ${ruleExpr.expr});`,
    );
    typeLines.push(
      `export type ${typeName(rule.name)} = z.infer<typeof ${schemaVarName(rule.name)}>;`,
    );
  }

  const header = [
    "// Generated by cddl.js. Do not edit by hand -- regenerate from the source .cddl instead.",
    "",
    'import { z } from "zod";',
    needsCbor ? 'import { cborDecodesAs } from "./runtime.js";' : undefined,
    "",
  ].filter((line): line is string => line !== undefined);

  return [...header, ...schemaLines, "", ...typeLines, ""].join("\n");
}
