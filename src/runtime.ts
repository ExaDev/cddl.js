// Small runtime support a generated module imports when its CDDL used the `.cbor`/`.cborseq` control operator: a byte string whose own decoded contents must validate against another schema (how COSE_Sign1's protected/payload fields nest a further CBOR-encoded value inside a bstr).

import { z } from "zod";
import { decode, cdeDecodeOptions } from "cbor2";

// Validates the embedded CBOR without transforming the field's own value: the original bytes pass through unchanged on success. A transform that returned the decoded value instead would make the outer schema's re-encoding produce a different byte string than the one that was decoded -- correctness for cddl.js's own round-trip guarantee (decode a conformance vector, validate it, re-encode it, get the identical wire bytes back) takes priority over the ergonomic of an already-decoded nested value; a caller that wants the inner value decodes it separately. The passed-in schema's own inferred type plays no part in the result (only its safeParse behaviour matters), so it takes no type parameter.
export function cborDecodesAs(schema: z.ZodType): z.ZodType<Uint8Array> {
  return z.instanceof(Uint8Array).superRefine((bytes, ctx) => {
    let decoded: unknown;
    try {
      decoded = decode(bytes, cdeDecodeOptions);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: `bytes do not decode as CBOR: ${String(error)}`,
      });
      return;
    }
    const result = schema.safeParse(decoded);
    if (!result.success) {
      ctx.addIssue({
        code: "custom",
        message: `decoded CBOR does not match the expected type: ${result.error.message}`,
      });
    }
  });
}
