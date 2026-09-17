import { createPaidFetch, getSolanaRpcUrl } from "./paid-fetch";
import type { PrivyKitSigner } from "./privy-kit-signer";
import { readSettledPayment } from "./settled-payment";
import { savePaymentReceipt } from "./settlement-receipts";
import { parseX402PaymentRequest } from "./x402-request";
import { refreshBalanceAfterPayment } from "@/wallet/balance-store";

export async function payForResource(input: {
  request: unknown;
  attemptId: string;
  getSigner: () => Promise<PrivyKitSigner>;
  onProgress?: (label: string) => void;
}) {
  const request = parseX402PaymentRequest(input.request);
  if (!request) throw new Error("The paid request does not match this endpoint's published contract.");
  input.onProgress?.("Preparing in-app wallet…");
  const signer = await input.getSigner();
  const client = await createPaidFetch({
    rpcUrl: getSolanaRpcUrl(),
    signer,
  });
  const requestInit = request.method === "POST"
    ? {
      method: "POST",
      headers: request.body === undefined
        ? undefined
        : { "Content-Type": "application/json" },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
    }
    : undefined;
  input.onProgress?.("Sending x402 request…");
  const result = await readSettledPayment({
    pay: async () => {
      const response = await client.fetch(request.resourceUrl, requestInit, "x402");
      input.onProgress?.("Checking payment receipt…");
      return response;
    },
  });

  refreshBalanceAfterPayment(signer.address);

  await savePaymentReceipt(input.attemptId, {
    url: request.resourceUrl,
    ...result,
  });
  return result;
}
