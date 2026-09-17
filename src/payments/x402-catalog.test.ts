import { expect, test } from "bun:test";

import { getX402EndpointContract, isValidCatalogRequest } from "./x402-catalog";

test("publishes the Nansen flow-intelligence contract used by the agent", () => {
  const resourceUrl = "https://api.nansen.ai/api/v1/tgm/flow-intelligence";
  expect(getX402EndpointContract(resourceUrl)).toMatchObject({
    method: "POST",
    required: ["chain", "token_address"],
  });
  expect(isValidCatalogRequest({
    resourceUrl,
    method: "POST",
    body: {
      chain: "solana",
      token_address: "So11111111111111111111111111111111111111112",
      timeframe: "1d",
    },
  })).toBe(true);
});
