import { describe, expect, it } from "bun:test";

import { attachPaymentRequiredHeader } from "./x402-fetch-compat";
import { parsePaymentRequiredHeader } from "./x402-request";

describe("attachPaymentRequiredHeader", () => {
  it("copies an x402 v1 JSON 402 into PAYMENT-REQUIRED", async () => {
    const body = {
      accepts: [
        {
          asset: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
          maxAmountRequired: "1000",
          network: "solana-devnet",
          payTo: "PayTo111111111111111111111111111111111111111",
          scheme: "exact",
        },
      ],
      x402Version: 1,
    };

    const response = await attachPaymentRequiredHeader(
      new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
        status: 402,
      }),
    );
    const header = response.headers.get("PAYMENT-REQUIRED");
    expect(header).toBeTruthy();
    expect(parsePaymentRequiredHeader(header!)).toEqual({
      amountAtomic: "1000",
      asset: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
      network: "solana-devnet",
      recipient: "PayTo111111111111111111111111111111111111111",
    });
  });
});
