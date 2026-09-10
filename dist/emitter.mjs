import camelCase from "camelcase";
//#region src/emitter.ts
function isPlainObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isUnknownArray(value) {
	return Array.isArray(value);
}
function isRawRule(value) {
	return isPlainObject(value) && typeof value.Type === "string" && typeof value.Name === "string";
}
function isOccurrence(value) {
	return isPlainObject(value) && typeof value.n === "number" && typeof value.m === "number";
}
function isLiteralValueNode(value) {
	return isPlainObject(value) && typeof value.Type === "string" && "Value" in value;
}
function mergeRules(parsed) {
	if (!isUnknownArray(parsed)) throw new Error("expected parse() to return an array of top-level rules");
	const byName = /* @__PURE__ */ new Map();
	for (const entry of parsed) {
		if (!isRawRule(entry)) throw new Error(`unrecognised top-level parse() entry: ${JSON.stringify(entry)}`);
		if (entry.Type !== "group" && entry.Type !== "array" && entry.Type !== "variable") throw new Error(`unsupported top-level rule kind "${entry.Type}" for rule "${entry.Name}"`);
		const existing = byName.get(entry.Name);
		if (existing) {
			if (!existing.isSocket) throw new Error(`rule "${entry.Name}" is defined more than once, outside cddl.js's supported subset (only a socket name, "$name /= X", may have multiple definitions)`);
			existing.raw.push(entry);
			continue;
		}
		byName.set(entry.Name, {
			name: entry.Name,
			isSocket: entry.Name.startsWith("$"),
			raw: [entry]
		});
	}
	return [...byName.values()];
}
function schemaVarName(ruleName) {
	const clean = ruleName.startsWith("$") ? ruleName.slice(1) : ruleName;
	return `${camelCase(clean)}Schema`;
}
function typeName(ruleName) {
	const clean = ruleName.startsWith("$") ? ruleName.slice(1) : ruleName;
	return camelCase(clean, { pascalCase: true });
}
function requireStringField(obj, key, ruleName) {
	const value = obj[key];
	if (typeof value !== "string") throw new Error(`rule "${ruleName}" is missing the expected "${key}" string field`);
	return value;
}
function requireObjectField(obj, key, ruleName) {
	const value = obj[key];
	if (!isPlainObject(value)) throw new Error(`rule "${ruleName}" is missing the expected "${key}" field`);
	return value;
}
function emitOccurrence(occurrence, inner, ruleName) {
	if (!isOccurrence(occurrence)) throw new Error(`rule "${ruleName}" has a member with an unrecognised Occurrence`);
	const { n, m } = occurrence;
	if (n === 1 && m === 1) return {
		expr: inner,
		optional: false
	};
	if (n === 0 && m === Infinity) return {
		expr: inner,
		optional: true
	};
	if (n === 0 && m === 1) return {
		expr: `${inner}.optional()`,
		optional: false
	};
	throw new Error(`rule "${ruleName}" uses an occurrence indicator (n=${String(n)}, m=${String(m)}) outside cddl.js's supported subset (?, required, or unbounded *)`);
}
function emitOperatorValue(operator, ruleName) {
	const opValue = operator.Value;
	if (isLiteralValueNode(opValue) && opValue.Type === "literal") return JSON.stringify(opValue.Value);
	throw new Error(`rule "${ruleName}" uses an unsupported operator value shape`);
}
function emitWithOperator(node, ruleName, refs) {
	const baseType = node.Type;
	const operator = requireObjectField(node, "Operator", ruleName);
	const operatorType = operator.Type;
	let baseExpr;
	if (typeof baseType === "string") baseExpr = emitNativeType(baseType, ruleName);
	else if (isPlainObject(baseType) && baseType.Type === "group" && typeof baseType.Value === "string") {
		refs.add(baseType.Value);
		baseExpr = `z.lazy(() => ${schemaVarName(baseType.Value)})`;
	} else throw new Error(`rule "${ruleName}" has an operator attached to an unsupported base type`);
	if (operatorType === "size") {
		const opValue = operator.Value;
		if (!isLiteralValueNode(opValue) || opValue.Type !== "literal" || typeof opValue.Value !== "number") throw new Error(`rule "${ruleName}" uses .size with a non-literal-integer value, outside cddl.js's supported subset`);
		const size = opValue.Value;
		return `${baseExpr}.refine((v) => v.length === ${String(size)}, { message: "expected exactly ${String(size)} bytes" })`;
	}
	if (operatorType === "regexp") {
		const pattern = emitOperatorValue(operator, ruleName);
		return `${baseExpr}.regex(new RegExp(${pattern}))`;
	}
	if (operatorType === "cbor" || operatorType === "cborseq") {
		const opValue = operator.Value;
		if (!isPlainObject(opValue) || opValue.Type !== "group" || typeof opValue.Value !== "string") throw new Error(`rule "${ruleName}" uses .cbor/.cborseq with a value that isn't a plain rule reference, outside cddl.js's supported subset`);
		refs.add(opValue.Value);
		return `cborDecodesAs(z.lazy(() => ${schemaVarName(opValue.Value)}))`;
	}
	throw new Error(`rule "${ruleName}" uses unsupported operator ".${String(operatorType)}"`);
}
function emitNativeType(name, ruleName) {
	switch (name) {
		case "bstr": return "z.instanceof(Uint8Array)";
		case "tstr": return "z.string()";
		case "int": return "z.number().int()";
		case "uint": return "z.number().int().nonnegative()";
		case "nint": return "z.number().int().negative()";
		case "bool": return "z.boolean()";
		case "any": return "z.unknown()";
		case "nil":
		case "null": return "z.null()";
		default: throw new Error(`rule "${ruleName}" uses native type "${name}", outside cddl.js's supported subset`);
	}
}
function buildLiteralKeyMap(rules) {
	const map = /* @__PURE__ */ new Map();
	for (const rule of rules) {
		if (rule.raw.length !== 1) continue;
		const entry = rule.raw[0];
		if (entry.Type !== "variable") continue;
		const propertyType = entry.PropertyType;
		if (!isUnknownArray(propertyType) || propertyType.length !== 1) continue;
		const only = propertyType[0];
		if (isLiteralValueNode(only) && only.Type === "literal" && (typeof only.Value === "string" || typeof only.Value === "number")) map.set(rule.name, only.Value);
	}
	return map;
}
function emitSingleType(node, ruleName, literalKeys, refs) {
	if (typeof node === "string") return emitNativeType(node, ruleName);
	if (!isPlainObject(node)) throw new Error(`rule "${ruleName}" has a property type that isn't a recognised shape: ${JSON.stringify(node)}`);
	if ("Operator" in node) return emitWithOperator(node, ruleName, refs);
	if (node.Type === "literal") return `z.literal(${JSON.stringify(node.Value)})`;
	if (node.Type === "group" && typeof node.Value === "string") {
		refs.add(node.Value);
		return `z.lazy(() => ${schemaVarName(node.Value)})`;
	}
	if (node.Type === "group" && "Properties" in node) return emitGroupExpr(node, ruleName, literalKeys, refs);
	if (node.Type === "array") return emitArrayExpr(node, ruleName, literalKeys, refs);
	throw new Error(`rule "${ruleName}" has a property type shape outside cddl.js's supported subset: ${JSON.stringify(node)}`);
}
/** A property type is normally an array of branch nodes (one per `/`-separated alternative), but the vendored parser emits a bare node directly -- not array-wrapped -- for an array's own anonymous, single-member value type (confirmed against wire-mesh's real spec: `entries: [* bstr]` produces a bare `"bstr"` where `peers: [* peer-advert]` produces a wrapped `[{Type:"group",...}]`). Both shapes are handled uniformly here. */
function emitPropertyType(types, ruleName, literalKeys, refs) {
	if (!isUnknownArray(types)) return emitSingleType(types, ruleName, literalKeys, refs);
	if (types.length === 0) throw new Error(`rule "${ruleName}" has an empty property type`);
	if (types.length === 1) return emitSingleType(types[0], ruleName, literalKeys, refs);
	return `z.union([${types.map((t) => emitSingleType(t, ruleName, literalKeys, refs)).join(", ")}])`;
}
function emitGroupProperties(properties, ruleName, literalKeys, refs) {
	if (!isUnknownArray(properties)) throw new Error(`rule "${ruleName}" has malformed Properties`);
	const fields = [];
	let catchall;
	for (const rawProp of properties) {
		if (!isPlainObject(rawProp)) throw new Error(`rule "${ruleName}" has a malformed property entry`);
		const occurrence = rawProp.Occurrence;
		const keyName = requireStringField(rawProp, "Name", ruleName);
		if (rawProp.HasCut === false) {
			const literalKey = literalKeys.get(keyName);
			if (literalKey !== void 0) {
				const { expr, optional } = emitOccurrence(occurrence, emitPropertyType(rawProp.Type, ruleName, literalKeys, refs), ruleName);
				fields.push(`  ${JSON.stringify(String(literalKey))}: ${optional ? `${expr}.optional()` : expr},`);
				continue;
			}
			if (isOccurrence(occurrence) && occurrence.n === 0 && occurrence.m === Infinity) {
				if (catchall !== void 0) throw new Error(`rule "${ruleName}" has more than one open-map-tail (* key => value) entry, outside cddl.js's supported subset (one per map)`);
				catchall = emitPropertyType(rawProp.Type, ruleName, literalKeys, refs);
				continue;
			}
			throw new Error(`rule "${ruleName}" has an arrow-syntax map entry ("${keyName} => ...") that is neither a known literal-valued key nor the open-tail pattern, outside cddl.js's supported subset`);
		}
		const { expr, optional } = emitOccurrence(occurrence, emitPropertyType(rawProp.Type, ruleName, literalKeys, refs), ruleName);
		fields.push(`  ${JSON.stringify(keyName)}: ${optional ? `${expr}.optional()` : expr},`);
	}
	return {
		fields,
		catchall
	};
}
function emitGroupExpr(entry, ruleName, literalKeys, refs) {
	const { fields, catchall } = emitGroupProperties(entry.Properties, ruleName, literalKeys, refs);
	const object = `z.object({\n${fields.join("\n")}\n})`;
	return catchall !== void 0 ? `${object}.catchall(${catchall})` : object;
}
function emitArrayExpr(entry, ruleName, literalKeys, refs) {
	const values = entry.Values;
	if (!isUnknownArray(values) || values.length === 0) throw new Error(`rule "${ruleName}" has malformed or empty array Values`);
	if (values.length === 1) {
		const only = values[0];
		if (isPlainObject(only)) {
			const occurrence = only.Occurrence;
			if (only.Name === "" && isOccurrence(occurrence) && occurrence.n === 0 && occurrence.m === Infinity) return `z.array(${emitPropertyType(only.Type, ruleName, literalKeys, refs)})`;
		}
	}
	return `z.tuple([${values.map((value) => {
		if (!isPlainObject(value)) throw new Error(`rule "${ruleName}" has a malformed array member`);
		const occurrence = value.Occurrence;
		if (!isOccurrence(occurrence) || occurrence.n !== 1 || occurrence.m !== 1) throw new Error(`rule "${ruleName}" mixes occurrence indicators within a fixed array, outside cddl.js's supported subset`);
		return emitPropertyType(value.Type, ruleName, literalKeys, refs);
	}).join(", ")}])`;
}
/** Emits one raw AST entry's own bare Zod expression (no `z.lazy`/`export const` wrapper), dispatching on that entry's own `Type` -- not the rule's, since a socket's entries can mix kinds (see MergedRule). */
function emitEntryExpr(entry, ruleName, literalKeys, refs) {
	const kind = entry.Type;
	if (kind === "group") return emitGroupExpr(entry, ruleName, literalKeys, refs);
	if (kind === "array") return emitArrayExpr(entry, ruleName, literalKeys, refs);
	if (kind === "variable") return emitPropertyType(entry.PropertyType, ruleName, literalKeys, refs);
	throw new Error(`rule "${ruleName}" has an unsupported top-level rule kind "${String(kind)}"`);
}
/** A rule with exactly one entry emits that entry's own expression directly; a socket with several entries (its base definition plus every `/=` choice-addition) unions every entry's own expression together. */
function computeRuleExpr(rule, literalKeys) {
	const refs = /* @__PURE__ */ new Set();
	const exprs = rule.raw.map((entry) => emitEntryExpr(entry, rule.name, literalKeys, refs));
	return {
		expr: rule.raw.length === 1 ? exprs.join("") : `z.union([${exprs.join(", ")}])`,
		refs
	};
}
/** A rule is "cyclic" if, following z.lazy() references transitively, it can reach itself -- e.g. `frame`'s own union includes `federation-envelope-frame`, whose `inner` field is `.cbor frame`, a reference straight back to `frame`. Only these rules need an explicit `z.ZodType` type annotation to break TypeScript's circular-inference restriction; every other rule can have its schema's concrete shape inferred naturally, which is the entire point of generating Zod schemas with attached inferred types rather than hand-written ones. */
function computeCyclicRules(perRule) {
	const cyclic = /* @__PURE__ */ new Set();
	for (const [name, ruleExpr] of perRule) {
		const visited = /* @__PURE__ */ new Set();
		const stack = [...ruleExpr.refs];
		while (stack.length > 0) {
			const next = stack.pop();
			if (next === void 0 || visited.has(next)) continue;
			visited.add(next);
			if (next === name) {
				cyclic.add(name);
				break;
			}
			const nextRefs = perRule.get(next)?.refs;
			if (nextRefs) stack.push(...nextRefs);
		}
	}
	return cyclic;
}
/** Compiles a parsed CDDL AST into a single TypeScript module source: one Zod schema plus one inferred type export per named rule. */
function emitModule(parsed) {
	const rules = mergeRules(parsed);
	const literalKeys = buildLiteralKeyMap(rules);
	const perRule = /* @__PURE__ */ new Map();
	for (const rule of rules) perRule.set(rule.name, computeRuleExpr(rule, literalKeys));
	const cyclicRules = computeCyclicRules(perRule);
	const schemaLines = [];
	const typeLines = [];
	const needsCbor = JSON.stringify(parsed).includes("\"cbor\"");
	for (const rule of rules) {
		const ruleExpr = perRule.get(rule.name);
		if (!ruleExpr) throw new Error(`internal error: no expression computed for rule "${rule.name}"`);
		const annotation = cyclicRules.has(rule.name) ? ": z.ZodType" : "";
		schemaLines.push(`export const ${schemaVarName(rule.name)}${annotation} = z.lazy(() => ${ruleExpr.expr});`);
		typeLines.push(`export type ${typeName(rule.name)} = z.infer<typeof ${schemaVarName(rule.name)}>;`);
	}
	return [
		...[
			"// Generated by cddl.js. Do not edit by hand -- regenerate from the source .cddl instead.",
			"",
			"import { z } from \"zod\";",
			needsCbor ? "import { cborDecodesAs } from \"./runtime.js\";" : void 0,
			""
		].filter((line) => line !== void 0),
		...schemaLines,
		"",
		...typeLines,
		""
	].join("\n");
}
//#endregion
export { emitModule, mergeRules };
