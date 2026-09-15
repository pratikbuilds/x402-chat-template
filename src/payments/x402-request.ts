import { z } from "zod";

export const SOLANA_MAINNET_NETWORK =
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
export const SOLANA_MAINNET_USDC_MINT =
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export const X402PaymentRequestSchema = z.object({
  resourceUrl: z.url().refine((value) => new URL(value).protocol === "https:"),
  reason: z.string().trim().min(1).max(280),
});

export type X402PaymentRequest = z.infer<typeof X402PaymentRequestSchema>;

export function parseX402PaymentRequest(input: unknown) {
  const result = X402PaymentRequestSchema.safeParse(input);
  return result.success ? result.data : null;
}

const mainnetRequirementSchema = z
  .object({
    scheme: z.literal("exact"),
    network: z.literal(SOLANA_MAINNET_NETWORK),
    amount: z.string().regex(/^[1-9]\d*$/),
    asset: z.literal(SOLANA_MAINNET_USDC_MINT),
    payTo: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
    maxTimeoutSeconds: z.number().int().positive(),
    extra: z
      .object({ feePayer: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/) })
      .passthrough()
      .optional(),
  })
  .passthrough();
const paymentRequiredSchema = z
  .object({
    x402Version: z.literal(2),
    accepts: z.array(z.unknown()).nonempty(),
    resource: z.object({ url: z.url() }).passthrough(),
  })
  .passthrough();

export type PaymentQuote = Awaited<ReturnType<typeof preparePayment>>;

export async function preparePayment(
  request: X402PaymentRequest,
  signal?: AbortSignal,
) {
  const response = await fetch(request.resourceUrl, { signal });
  if (response.status !== 402)
    throw new Error("This URL did not require an x402 payment.");
  const header = response.headers.get("payment-required");
  const body: unknown = header
    ? JSON.parse(
        new TextDecoder().decode(
          Uint8Array.from(atob(header), (char) => char.charCodeAt(0)),
        ),
      )
    : await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    (body as { x402Version?: unknown }).x402Version !== 2
  ) {
    throw new Error("This demo supports x402 v2 payments only.");
  }
  const parsed = paymentRequiredSchema.safeParse(body);
  if (!parsed.success) throw new Error("Invalid x402 payment challenge.");
  const required = parsed.data;
  if (required.resource.url !== request.resourceUrl) {
    throw new Error("Payment challenge belongs to another URL.");
  }
  const selected = required.accepts
    .map((requirement) => mainnetRequirementSchema.safeParse(requirement))
    .find((result) => result.success)?.data;
  if (!selected) {
    throw new Error(
      "This demo supports exact Solana mainnet USDC payments only.",
    );
  }
  // Sign only the option shown in the approval card.
  const paymentRequired = { ...required, accepts: [selected] };
  return {
    request,
    amountAtomic: selected.amount,
    recipient: selected.payTo,
    paymentRequired,
  };
}
