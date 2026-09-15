import { createPaidFetch, getSolanaRpcUrl } from "./paid-fetch";
import type { PrivyKitSigner } from "./privy-kit-signer";
import { readSettledPayment } from "./settled-payment";
import { savePaymentReceipt } from "./settlement-receipts";
import { X402PaymentRequestSchema } from "./x402-request";

export async function payForResource(input: {
  request: unknown;
  attemptId: string;
  getSigner: () => Promise<PrivyKitSigner>;
}) {
  const request = X402PaymentRequestSchema.parse(input.request);
  const signer = await input.getSigner();
  const client = await createPaidFetch({
    rpcUrl: getSolanaRpcUrl(),
    signer,
  });
  const result = await readSettledPayment({
    pay: () => client.fetch(request.resourceUrl, undefined, "x402"),
  });

  await savePaymentReceipt(input.attemptId, {
    url: request.resourceUrl,
    ...result,
  });
  return result;
}
