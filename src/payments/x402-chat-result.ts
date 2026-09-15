import { z } from "zod";

export const X402ChatResultSchema = z.object({
  url: z.string(),
  body: z.string(),
  signature: z.string(),
});
export type X402ChatResult = z.infer<typeof X402ChatResultSchema>;
