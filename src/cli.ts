// Usage: node src/cli.ts <input.cddl> <output.ts>
import { writeFileSync } from "node:fs";
import { parse } from "../vendor/cddl/dist/index.js";
import { emitModule } from "./emitter.ts";

const [, , input, output] = process.argv;
if (input === undefined || output === undefined) {
  console.error("usage: cddl.js <input.cddl> <output.ts>");
  process.exit(1);
}

const parsed = parse(input);
const source = emitModule(parsed);
writeFileSync(output, source);
console.log(`wrote ${output}`);
