import { z } from "zod";

import { getSolanaRpcUrl } from "@/payments/paid-fetch";
import { SOLANA_MAINNET_USDC_MINT } from "@/payments/x402-request";

const solResponse = z.object({
  result: z.object({ value: z.number().int().nonnegative() }),
});
const tokenResponse = z.object({
  result: z.object({
    value: z.array(z.object({
      account: z.object({
        data: z.object({
          parsed: z.object({
            info: z.object({
              tokenAmount: z.object({
                amount: z.string().regex(/^\d+$/),
                decimals: z.literal(6),
              }),
            }),
          }),
        }),
      }),
    })),
  }),
});

export async function getWalletBalances(address: string, signal: AbortSignal) {
  const rpcUrl = getSolanaRpcUrl();
  async function request(method: string, params: unknown[]) {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: method, method, params }),
      signal,
    });
    if (!response.ok) throw new Error(`Balance request failed (${response.status}).`);
    return response.json();
  }

  const [sol, tokens] = await Promise.all([
    request("getBalance", [address, { commitment: "confirmed" }]),
    request("getTokenAccountsByOwner", [
      address,
      { mint: SOLANA_MAINNET_USDC_MINT },
      { encoding: "jsonParsed", commitment: "confirmed" },
    ]),
  ]);
  return {
    sol: solResponse.parse(sol).result.value / 1e9,
    usdc: tokenResponse.parse(tokens).result.value.reduce(
      (total, item) => total + Number(item.account.data.parsed.info.tokenAmount.amount),
      0,
    ) / 1e6,
  };
}
