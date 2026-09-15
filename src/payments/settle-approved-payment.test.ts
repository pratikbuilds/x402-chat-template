import { afterEach, expect, test } from "bun:test";
import { address } from "@solana/kit";
import { createPaidFetch } from "./paid-fetch";
import { PaymentRejectedError } from "./payment-errors";
import {
  preparePayment,
  SOLANA_MAINNET_NETWORK,
  SOLANA_MAINNET_USDC_MINT,
  X402PaymentRequestSchema,
} from "./x402-request";
import {
  AmbiguousPaymentError,
  settleApprovedPayment,
} from "./settle-approved-payment";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const request = {
  resourceUrl: "https://provider.example/fact",
  reason: "Get a fact",
};
const recipient = "5SgBRuPAgEP1Fifjyderse7tW6ZVGEfJ5PAE18QDRwbx";
const required = {
  x402Version: 2,
  resource: {
    url: request.resourceUrl,
    description: "Paid fact",
    mimeType: "application/json",
  },
  accepts: [
    {
      scheme: "exact",
      network: "eip155:8453",
      amount: "1000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo: "0x52F2a6A0dF5e6A34B37B2b6C5b8A5C10CE260aDe",
      maxTimeoutSeconds: 60,
    },
    {
      scheme: "exact",
      network: SOLANA_MAINNET_NETWORK,
      amount: "1000",
      asset: SOLANA_MAINNET_USDC_MINT,
      payTo: recipient,
      maxTimeoutSeconds: 60,
      extra: { feePayer: recipient },
    },
  ],
};
function serve(body: unknown) {
  globalThis.fetch = async () =>
    new Response(JSON.stringify(body), { status: 402 });
}

test("endpoint supplies mainnet terms; Pay Kit stays scoped and receipts prevent ambiguous retries", async () => {
  expect(
    X402PaymentRequestSchema.parse({
      ...request,
      recipient: "stale",
      amountAtomic: "999",
    }),
  ).toEqual(request);
  serve(required);
  const quote = await preparePayment(request);
  expect(quote.recipient).toBe(recipient);
  expect(quote.amountAtomic).toBe("1000");
  const fetchBeforeClient = globalThis.fetch;
  const pay = await createPaidFetch({
    rpcUrl: "https://api.mainnet-beta.solana.com",
    quote,
    signer: {
      address: address("11111111111111111111111111111111"),
      signMessages: async () => [],
      signTransactions: async () => [],
    },
    beforeSubmit: async () => {},
  });
  expect(typeof pay).toBe("function");
  expect(globalThis.fetch).toBe(fetchBeforeClient);
  const signature = "5HjgkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYz11111";
  const result = await settleApprovedPayment({
    quote,
    pay: async () =>
      new Response("fact", {
        headers: {
          "X-PAYMENT-RESPONSE": btoa(
            JSON.stringify({ success: true, transaction: signature }),
          ),
        },
      }),
  });
  expect(result).toEqual({ paidBody: "fact", signature });
  await expect(
    settleApprovedPayment({
      quote,
      pay: async () => new Response("timeout", { status: 502 }),
    }),
  ).rejects.toBeInstanceOf(AmbiguousPaymentError);
  await expect(
    settleApprovedPayment({
      quote,
      pay: async () =>
        new Response("failed", {
          headers: {
            "X-PAYMENT-RESPONSE": btoa(
              JSON.stringify({ success: false, transaction: signature }),
            ),
          },
        }),
    }),
  ).rejects.toBeInstanceOf(AmbiguousPaymentError);
  serve({
    ...required,
    accepts: [required.accepts[0]],
  });
  await expect(preparePayment(request)).rejects.toThrow("mainnet USDC");
});

test("shows endpoint rejection details while blocking an unconfirmed payment retry", async () => {
  serve(required);
  const quote = await preparePayment(request);
  await expect(settleApprovedPayment({
    quote,
    pay: async () => new Response('{"error":"invalid_payload"}', { status: 402 }),
  })).rejects.toThrow('HTTP 402 without settlement confirmation. Response: invalid_payload');
});

test("distinguishes explicit pre-settlement verification rejection from an uncertain response", async () => {
  serve(required);
  const quote = await preparePayment(request);
  await expect(settleApprovedPayment({
    quote,
    pay: async () => new Response(JSON.stringify({
      error: "Payment Invalid",
      message: "Payment verification failed. Fetch and sign this fresh challenge, then retry the identical request.",
    }), { status: 402 }),
  })).rejects.toBeInstanceOf(PaymentRejectedError);
  await expect(settleApprovedPayment({
    quote,
    pay: async () => new Response('{"error":"Payment Required"}', { status: 402 }),
  })).rejects.toBeInstanceOf(AmbiguousPaymentError);
});
