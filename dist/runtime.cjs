Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let zod = require("zod");
let cbor2 = require("cbor2");
//#region src/runtime.ts
function cborDecodesAs(schema) {
	return zod.z.instanceof(Uint8Array).superRefine((bytes, ctx) => {
		let decoded;
		try {
			decoded = (0, cbor2.decode)(bytes, cbor2.cdeDecodeOptions);
		} catch (error) {
			ctx.addIssue({
				code: "custom",
				message: `bytes do not decode as CBOR: ${String(error)}`
			});
			return;
		}
		const result = schema.safeParse(decoded);
		if (!result.success) ctx.addIssue({
			code: "custom",
			message: `decoded CBOR does not match the expected type: ${result.error.message}`
		});
	});
}
//#endregion
exports.cborDecodesAs = cborDecodesAs;
