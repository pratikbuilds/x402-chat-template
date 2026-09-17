import { z } from "zod";
import { isValidCatalogRequest } from "./x402-catalog";

export const SOLANA_MAINNET_USDC_MINT =
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export const X402PaymentRequestSchema = z.object({
  resourceUrl: z.url().refine((value) => new URL(value).protocol === "https:"),
  reason: z.string().trim().min(1).max(280),
  method: z.enum(["GET", "POST"]).default("GET"),
  body: z.record(z.string(), z.unknown()).optional(),
}).superRefine((request, context) => {
  if (request.method === "GET" && request.body !== undefined) {
    context.addIssue({
      code: "custom",
      message: "GET x402 requests cannot include a JSON body.",
      path: ["body"],
    });
  }
});

export type X402PaymentRequest = z.infer<typeof X402PaymentRequestSchema>;

export function parseX402PaymentRequest(input: unknown) {
  const result = X402PaymentRequestSchema.safeParse(input);
  if (!result.success || !isValidCatalogRequest(result.data)) return null;
  return result.data;
}
