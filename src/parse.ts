// Wraps the vendored parser's own parse() as public library surface. Consumers that need to run cddl.js's own generation pipeline themselves (parse a .cddl file, then emitModule() the result) -- rather than shelling out to src/cli.ts -- need this to get a parsed AST at all; emitModule alone only accepts one, it doesn't produce one. Typed unknown at this boundary, not the vendored parser's own Assignment[] type, matching emitModule/mergeRules's existing unknown-typed input -- the vendored AST shape is an implementation detail, not part of cddl.js's own public contract.
import { parse as vendorParse } from "../vendor/cddl/dist/index.js";

export function parse(filePath: string): unknown {
  return vendorParse(filePath);
}
