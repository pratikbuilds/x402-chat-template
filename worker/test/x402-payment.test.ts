import { describe, expect, it, vi } from "vitest";

import {
  createX402PaymentTool,
  type X402PaymentRequest,
  X402PaymentRequestSchema,
  X402SettlementReportSchema,
} from "../src/x402-payment";

const request = {
  amountAtomic: "2500",
  asset: "USDC",
  network: "solana:devnet",
  reason: "Pay for the requested API call",
  recipient: "Recipient111111111111111111111111111111111111",
  resourceUrl: "https://provider.example/api/data",
} satisfies X402PaymentRequest;

describe("request_x402_payment", () => {
  it("requires approval and only records an exact request after execution", async () => {
    const createApproval = vi.fn(async () => ({ approvalId: "approval-1" }));
    const paymentTool = createX402PaymentTool({
      createApproval,
      now: () => 1_000,
    });

    expect(paymentTool.needsApproval).toBe(true);
    expect(createApproval).not.toHaveBeenCalled();
    expect(X402PaymentRequestSchema.safeParse(request).success).toBe(true);

    if (!paymentTool.execute) {
      throw new Error("The payment tool must have an execution boundary.");
    }

    await expect(
      paymentTool.execute(request, {
        messages: [],
        toolCallId: "tool-call-1",
      }),
    ).resolves.toEqual({
      approvalId: "approval-1",
      expiresAt: 301_000,
      request,
      status: "approved_for_client_signing",
    });
    expect(createApproval).toHaveBeenCalledWith(request, 301_000);
  });

  it("returns a stored client settlement signature after approval", async () => {
    const paymentTool = createX402PaymentTool({
      createApproval: async () => ({ approvalId: "approval-2" }),
      findSettlement: async () => ({
        paidBody: '{"fact":"hello"}',
        signature: "5HjgkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYz11111",
      }),
      now: () => 1_000,
    });

    if (!paymentTool.execute) {
      throw new Error("The payment tool must have an execution boundary.");
    }

    await expect(
      paymentTool.execute(request, {
        messages: [],
        toolCallId: "tool-call-2",
      }),
    ).resolves.toEqual({
      approvalId: "approval-2",
      expiresAt: 301_000,
      paidBody: '{"fact":"hello"}',
      request,
      signature: "5HjgkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYz11111",
      status: "settled",
    });
  });

  it("looks up a stored settlement by toolCallId, not request content", async () => {
    const seen: string[] = [];
    const paymentTool = createX402PaymentTool({
      createApproval: async () => ({ approvalId: "approval-3" }),
      findSettlement: async (toolCallId) => {
        seen.push(toolCallId);
        return null;
      },
      now: () => 1_000,
    });

    if (!paymentTool.execute) {
      throw new Error("The payment tool must have an execution boundary.");
    }

    await paymentTool.execute(request, {
      messages: [],
      toolCallId: "tool-call-3",
    });
    expect(seen).toEqual(["tool-call-3"]);
  });

  it("rejects payment requests outside the devnet USDC contract", () => {
    expect(
      X402PaymentRequestSchema.safeParse({
        ...request,
        amountAtomic: "0",
      }).success,
    ).toBe(false);
    expect(
      X402PaymentRequestSchema.safeParse({
        ...request,
        network: "solana:mainnet",
      }).success,
    ).toBe(false);
    expect(
      X402PaymentRequestSchema.safeParse({
        ...request,
        resourceUrl: "http://provider.example/api/data",
      }).success,
    ).toBe(false);
    expect(
      X402PaymentRequestSchema.safeParse({
        ...request,
        unexpected: true,
      }).success,
    ).toBe(false);
    expect(
      X402SettlementReportSchema.safeParse({
        paidBody: '{"fact":"hello"}',
        request,
        signature: "5HjgkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYz11111",
        toolCallId: "tool-call-1",
      }).success,
    ).toBe(true);
    expect(
      X402SettlementReportSchema.safeParse({
        request,
        signature: "5HjgkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYz11111",
        toolCallId: "tool-call-1",
      }).success,
    ).toBe(false);
    expect(
      X402SettlementReportSchema.safeParse({
        request,
        signature: "not-a-signature",
        toolCallId: "tool-call-1",
      }).success,
    ).toBe(false);
  });
});
