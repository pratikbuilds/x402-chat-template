import { tool } from "ai";
import { z } from "zod";

export const X402_PAYMENT_TOOL_NAME = "request_x402_payment";
export const X402_PAYMENT_APPROVAL_TTL_MS = 5 * 60 * 1000;

export const X402PaymentRequestSchema = z.object({
  resourceUrl: z.url().refine(
    (value) => new URL(value).protocol === "https:",
    "resourceUrl must use HTTPS",
  ),
  network: z.literal("solana:devnet"),
  asset: z.literal("USDC"),
  amountAtomic: z.string().regex(/^[1-9]\d*$/),
  recipient: z.string().min(1).max(128),
  reason: z.string().trim().min(1).max(280),
}).strict();

export type X402PaymentRequest = z.infer<typeof X402PaymentRequestSchema>;

export type X402PaymentApprovalResult = Readonly<{
  approvalId: string;
  expiresAt: number;
  request: X402PaymentRequest;
  settlement: "not_submitted";
  status: "approved_for_client_signing";
}>;

export function createX402PaymentTool({
  createApproval,
  now = Date.now,
}: {
  createApproval: (
    request: X402PaymentRequest,
    expiresAt: number,
  ) => Promise<{ approvalId: string }>;
  now?: () => number;
}) {
  return tool({
    description:
      "Request explicit user approval for one exact x402 payment. This tool never signs, submits, retries, or claims that funds were sent.",
    inputSchema: X402PaymentRequestSchema,
    needsApproval: true,
    execute: async (request): Promise<X402PaymentApprovalResult> => {
      const expiresAt = now() + X402_PAYMENT_APPROVAL_TTL_MS;
      const { approvalId } = await createApproval(request, expiresAt);

      return {
        approvalId,
        expiresAt,
        request,
        settlement: "not_submitted",
        status: "approved_for_client_signing",
      };
    },
  });
}
