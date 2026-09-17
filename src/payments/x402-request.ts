import { z } from "zod";
import { X402CatalogPaymentSchema } from "./pay-catalog";

export const SOLANA_MAINNET_USDC_MINT =
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export const X402PaymentRequestSchema = z.object({
  providerFqn: X402CatalogPaymentSchema.shape.providerFqn,
  resourceUrl: z.url().refine((value) => new URL(value).protocol === "https:"),
  reason: z.string().trim().min(1).max(280),
  method: X402CatalogPaymentSchema.shape.method,
  body: z.record(z.string(), z.unknown()).optional(),
});

export type X402PaymentRequest = z.infer<typeof X402PaymentRequestSchema>;

export function parseX402PaymentRequest(input: unknown) {
  const result = X402PaymentRequestSchema.safeParse(input);
  return result.success ? result.data : null;
}
