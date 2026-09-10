//#region src/emitter.d.ts
/** A named rule, after socket (`$name /= X`) choice-additions for the same name have been merged into one combined union. A socket's own entries can mix AST kinds -- e.g. `$manage-command-params = {* tstr => any}` (a group) extended by `$manage-command-params /= pty-spawn / ...` (a variable union of group references) -- so `raw` carries each entry's own kind rather than one shared kind for the whole rule; emitEntryExpr dispatches per entry. `raw` is a non-empty tuple type -- mergeRules never produces a MergedRule without at least one entry -- so callers can index `raw[0]` without an undefined check. */
interface MergedRule {
  name: string;
  isSocket: boolean;
  raw: [Record<string, unknown>, ...Record<string, unknown>[]];
}
export declare function mergeRules(parsed: unknown): MergedRule[];
/** Compiles a parsed CDDL AST into a single TypeScript module source: one Zod schema plus one inferred type export per named rule. */
export declare function emitModule(parsed: unknown): string;
//#endregion