import { address } from "@solana/kit";
import { describe, expect, it } from "bun:test";

import { createPaidFetch, getSolanaRpcUrl, queueVerified402 } from "./paid-fetch";

describe("createPaidFetch", () => {
  it("fails closed when the Solana RPC URL is missing", () => {
    expect(() => getSolanaRpcUrl("")).toThrow(
      "EXPO_PUBLIC_SOLANA_RPC_URL is not set.",
    );
  });

  it("constructs a client without a CryptoKeyPair", async () => {
    const signer = {
      address: address("11111111111111111111111111111111"),
      async signMessages() {
        return [];
      },
      async signTransactions() {
        return [];
      },
    };

    const client = await createPaidFetch({
      rpcUrl: "https://api.devnet.solana.com",
      signer,
    });

    expect(typeof client.fetch).toBe("function");
    expect("keyPair" in signer).toBe(false);
  });

  it("replays a queued verified 402 once", async () => {
    const url = "https://provider.example/queued-402";
    queueVerified402(url, new Response("challenge", { status: 402 }));

    const first = await fetch(url);
    expect(first.status).toBe(402);
    expect(await first.text()).toBe("challenge");
  });
});
