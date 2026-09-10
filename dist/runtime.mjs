import { z } from "zod";
import { cdeDecodeOptions, decode } from "cbor2";
//#region src/runtime.ts
function cborDecodesAs(schema) {
	return z.instanceof(Uint8Array).superRefine((bytes, ctx) => {
		let decoded;
		try {
			decoded = decode(bytes, cdeDecodeOptions);
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
export { cborDecodesAs };
