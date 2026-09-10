import { z } from "zod";
//#region src/runtime.d.ts
export declare function cborDecodesAs(schema: z.ZodType): z.ZodType<Uint8Array>;
//#endregion