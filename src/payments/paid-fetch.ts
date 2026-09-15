import type { KeyPairSigner } from "@solana/kit";
import { AmbiguousPaymentError } from "./payment-errors";
import type { PrivyKitSigner } from "./privy-kit-signer";
import type { PaymentQuote } from "./x402-request";

export function getSolanaRpcUrl(
  value = process.env.EXPO_PUBLIC_SOLANA_RPC_URL,
) {
  if (!value) throw new Error("EXPO_PUBLIC_SOLANA_RPC_URL is not set.");
  return value;
}

export async function createPaidFetch(input: {
  rpcUrl: string;
  signer: PrivyKitSigner;
  quote: PaymentQuote;
  beforeSubmit: () => Promise<void>;
}) {
  const { createPayKitClient } = await import("@solana/pay-kit/client");
  const nativeFetch = globalThis.fetch.bind(globalThis);
  let servedChallenge = false;
  let submitted = false;
  const client = await createPayKitClient({
    accept: ["x402"],
    rpcUrl: input.rpcUrl,
    signer: input.signer as KeyPairSigner,
    fetch: async (_url, init) => {
      if (!servedChallenge) {
        servedChallenge = true;
        const bytes = new TextEncoder().encode(
          JSON.stringify(input.quote.paymentRequired),
        );
        return new Response(null, {
          status: 402,
          headers: { "PAYMENT-REQUIRED": btoa(String.fromCharCode(...bytes)) },
        });
      }
      await input.beforeSubmit();
      submitted = true;
      return nativeFetch(input.quote.request.resourceUrl, {
        ...init,
        redirect: "error",
      });
    },
  });
  return async () => {
    try {
      return await client.fetch(
        input.quote.request.resourceUrl,
        undefined,
        "x402",
      );
    } catch (error) {
      if (submitted)
        throw new AmbiguousPaymentError(
          "Payment may have been sent, but the response was lost. Do not pay again.",
        );
      throw error;
    }
  };
}
