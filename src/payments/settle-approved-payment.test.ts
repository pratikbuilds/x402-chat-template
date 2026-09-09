import { describe, expect, it, mock } from "bun:test";

import { AmbiguousPaymentError, settleApprovedPayment } from "./settle-approved-payment";
import {
  matchApprovedChallenge,
  parsePaymentRequiredHeader,
  SOLANA_DEVNET_USDC_MINT,
  type X402PaymentRequest,
} from "./x402-request";

const request = {
  amountAtomic: "2500",
  asset: "USDC",
  network: "solana:devnet",
  reason: "Pay for the requested API call",
  recipient: "Recipient111111111111111111111111111111111111",
  resourceUrl: "https://provider.example/api/data",
} satisfies X402PaymentRequest;

function encodeHeader(value: unknown) {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  return globalThis.btoa(String.fromCharCode(...bytes));
}

const matchingRequired = {
  accepts: [
    {
      amount: "2500",
      asset: SOLANA_DEVNET_USDC_MINT,
      maxTimeoutSeconds: 60,
      network: "solana:devnet",
      payTo: request.recipient,
      scheme: "exact",
    },
  ],
  resource: { url: request.resourceUrl },
  x402Version: 2,
};

describe("matchApprovedChallenge", () => {
  it("accepts the approved amount, recipient, network, and devnet USDC mint", () => {
    const challenge = parsePaymentRequiredHeader(encodeHeader(matchingRequired));

    expect(challenge).not.toBeNull();
    expect(matchApprovedChallenge(request, challenge!)).toEqual({ ok: true });
  });

  it("accepts x402 v1 solana-devnet as solana:devnet", () => {
    expect(
      matchApprovedChallenge(request, {
        amountAtomic: "2500",
        asset: SOLANA_DEVNET_USDC_MINT,
        network: "solana-devnet",
        recipient: request.recipient,
      }),
    ).toEqual({ ok: true });
  });

  it("refuses a different amount", () => {
    expect(
      matchApprovedChallenge(request, {
        amountAtomic: "2501",
        asset: SOLANA_DEVNET_USDC_MINT,
        network: "solana:devnet",
        recipient: request.recipient,
      }),
    ).toEqual({ ok: false, reason: "amount" });
  });
});

describe("settleApprovedPayment", () => {
  it("pays only after the 402 matches the approved request", async () => {
    const probe = mock(
      async () =>
        new Response(null, {
          headers: {
            "PAYMENT-REQUIRED": encodeHeader(matchingRequired),
          },
          status: 402,
        }),
    );
    const pay = mock(
      async () =>
        new Response('{"fact":"paid resource"}', {
          headers: {
            "PAYMENT-RESPONSE": encodeHeader({
              network: "solana:devnet",
              success: true,
              transaction: "5SettlementSignature111111111111111111111111111",
            }),
          },
          status: 200,
        }),
    );

    await expect(
      settleApprovedPayment({ pay, probe, request }),
    ).resolves.toEqual({
      paidBody: '{"fact":"paid resource"}',
      signature: "5SettlementSignature111111111111111111111111111",
    });
    expect(pay).toHaveBeenCalledTimes(1);
    expect(pay.mock.calls[0]?.[0]).toBe(request.resourceUrl);
    expect(pay.mock.calls[0]?.[1]).toBeInstanceOf(Response);
  });

  it("keeps a settlement signature when the paid HTTP retry is not ok", async () => {
    const probe = mock(
      async () =>
        new Response(null, {
          headers: {
            "PAYMENT-REQUIRED": encodeHeader(matchingRequired),
          },
          status: 402,
        }),
    );
    const pay = mock(
      async () =>
        new Response("facilitator timeout", {
          headers: {
            "PAYMENT-RESPONSE": encodeHeader({
              network: "solana:devnet",
              success: true,
              transaction: "5SettlementSignature111111111111111111111111111",
            }),
          },
          status: 503,
        }),
    );

    await expect(
      settleApprovedPayment({ pay, probe, request }),
    ).resolves.toEqual({
      paidBody: "facilitator timeout",
      signature: "5SettlementSignature111111111111111111111111111",
    });
  });

  it("does not allow a pay retry when a failed paid response has no signature", async () => {
    const probe = mock(
      async () =>
        new Response(null, {
          headers: {
            "PAYMENT-REQUIRED": encodeHeader(matchingRequired),
          },
          status: 402,
        }),
    );
    const pay = mock(async () => new Response("upstream failed", { status: 502 }));

    await expect(
      settleApprovedPayment({ pay, probe, request }),
    ).rejects.toBeInstanceOf(AmbiguousPaymentError);
  });

  it("does not sign when the 402 amount does not match", async () => {
    const probe = mock(
      async () =>
        new Response(null, {
          headers: {
            "PAYMENT-REQUIRED": encodeHeader({
              ...matchingRequired,
              accepts: [
                {
                  ...matchingRequired.accepts[0],
                  amount: "9999",
                },
              ],
            }),
          },
          status: 402,
        }),
    );
    const pay = mock(async () => new Response("should not pay"));

    await expect(
      settleApprovedPayment({ pay, probe, request }),
    ).rejects.toThrow("amount");
    expect(pay).not.toHaveBeenCalled();
  });
});
