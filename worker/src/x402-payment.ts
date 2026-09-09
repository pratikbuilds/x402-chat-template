import { tool } from "ai";
import { z } from "zod";

export const X402_PAYMENT_TOOL_NAME = "request_x402_payment";
export const X402_PAYMENT_APPROVAL_TTL_MS = 5 * 60 * 1000;
export const X402_SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,88}$/;

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

export const X402SettlementReportSchema = z.object({
  request: X402PaymentRequestSchema,
  signature: z.string().regex(X402_SIGNATURE_PATTERN),
  toolCallId: z.string().min(1),
}).strict();

export type X402PaymentRequest = z.infer<typeof X402PaymentRequestSchema>;
export type X402SettlementReport = z.infer<typeof X402SettlementReportSchema>;

export type X402PaymentApprovalResult = Readonly<{
  approvalId: string;
  expiresAt: number;
  request: X402PaymentRequest;
  settlement: "not_submitted" | "submitted";
  signature?: string;
  status: "approved_for_client_signing" | "settled";
}>;

export function x402SettlementStorageKey(toolCallId: string) {
  return `x402:settlement:${toolCallId}`;
}

export function createX402PaymentTool({
  createApproval,
  findSettlement,
  now = Date.now,
}: {
  createApproval: (
    request: X402PaymentRequest,
    expiresAt: number,
  ) => Promise<{ approvalId: string }>;
  findSettlement?: (
    toolCallId: string,
  ) => Promise<{ signature: string } | null>;
  now?: () => number;
}) {
  return tool({
    description:
      "Request explicit user approval for one exact x402 payment. This tool never signs, submits, retries, or claims that funds were sent unless a matching client settlement signature is already stored.",
    inputSchema: X402PaymentRequestSchema,
    needsApproval: true,
    execute: async (request, options): Promise<X402PaymentApprovalResult> => {
      const expiresAt = now() + X402_PAYMENT_APPROVAL_TTL_MS;
      const { approvalId } = await createApproval(request, expiresAt);
      const settlement =
        (await findSettlement?.(options.toolCallId)) ?? null;

      if (settlement) {
        return {
          approvalId,
          expiresAt,
          request,
          settlement: "submitted",
          signature: settlement.signature,
          status: "settled",
        };
      }

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
