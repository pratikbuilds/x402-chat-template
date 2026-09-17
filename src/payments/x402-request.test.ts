import { expect, test } from "bun:test";

import { parseX402PaymentRequest } from "./x402-request";

test("rejects a catalog request that combines Nansen timeframe and date", () => {
  expect(parseX402PaymentRequest({
    resourceUrl: "https://api.nansen.ai/api/v1/token-screener",
    reason: "Find Solana smart-money tokens",
    method: "POST",
    body: {
      chains: ["solana"],
      timeframe: "24h",
      date: { from: "2025-01-08T00:00:00Z", to: "2025-01-08T23:59:59Z" },
    },
  })).toBeNull();
});
