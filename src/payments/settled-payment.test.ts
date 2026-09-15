import { expect, test } from "bun:test";
import { address } from "@solana/kit";
import { createPaidFetch } from "./paid-fetch";
import { readSettledPayment } from "./settled-payment";

const signature = "5HjgkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYz11111";

test("creates an unmodified Pay Kit x402 client", async () => {
  const fetchBeforeClient = globalThis.fetch;
  const client = await createPaidFetch({
    rpcUrl: "https://api.mainnet-beta.solana.com",
    signer: {
      address: address("11111111111111111111111111111111"),
      signMessages: async () => [],
      signTransactions: async () => [],
    },
  });

  expect(typeof client.fetch).toBe("function");
  expect(globalThis.fetch).toBe(fetchBeforeClient);
});

test("reads a confirmed payment response", async () => {
  const result = await readSettledPayment({
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
});

test("does not store an unconfirmed response as a payment", async () => {
  await expect(
    readSettledPayment({
      pay: async () => new Response("timeout", { status: 502 }),
    }),
  ).rejects.toThrow("without settlement confirmation");
  await expect(
    readSettledPayment({
      pay: async () =>
        new Response("failed", {
          headers: {
            "X-PAYMENT-RESPONSE": btoa(
              JSON.stringify({ success: false, transaction: signature }),
            ),
          },
        }),
    }),
  ).rejects.toThrow("without settlement confirmation");
});
