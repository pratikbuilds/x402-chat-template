import { createPaidFetch, getSolanaRpcUrl } from "./paid-fetch";
import { PaymentRejectedError } from "./payment-errors";
import type { PrivyKitSigner } from "./privy-kit-signer";
import { settleApprovedPayment } from "./settle-approved-payment";
import { assertPaymentResourceAvailable, loadPaymentAttempt, savePaymentAttempt } from "./settlement-receipts";
import { preparePayment, X402PaymentRequestSchema } from "./x402-request";

// ponytail: one payment at a time; use wallet-scoped locks if parallel payments are needed.
let paying = false;

export async function payForResource(input: Parameters<typeof executePayment>[0]) {
  if (paying) throw new Error("A payment is already in progress.");
  paying = true;
  try {
    return await executePayment(input);
  } finally {
    paying = false;
  }
}

async function executePayment(input: {
  request: unknown;
  attemptId: string;
  getSigner: () => Promise<PrivyKitSigner>;
}) {
  const existing = await loadPaymentAttempt(input.attemptId);
  if (existing?.kind === "settled") return existing;
  if (existing?.kind === "unknown") {
    throw new Error("This call was already submitted without a confirmed result.");
  }
  const request = X402PaymentRequestSchema.parse(input.request);
  const signer = await input.getSigner();
  const resourceKey = await assertPaymentResourceAvailable(signer.address, request.resourceUrl);
  const execute = async () => {
    const quote = await preparePayment(request, AbortSignal.timeout(15000));
    const pay = await createPaidFetch({
      quote,
      rpcUrl: getSolanaRpcUrl(),
      signer,
      beforeSubmit: async () => {
        await savePaymentAttempt(resourceKey, { kind: "unknown" });
        await savePaymentAttempt(input.attemptId, { kind: "unknown" });
      },
    });
    try {
      return await settleApprovedPayment({ pay, quote });
    } catch (error) {
      if (error instanceof PaymentRejectedError) {
        await savePaymentAttempt(resourceKey, { kind: "rejected" });
        await savePaymentAttempt(input.attemptId, { kind: "rejected" });
      }
      throw error;
    }
  };
  const result = await execute().catch((error: unknown) => {
    if (error instanceof PaymentRejectedError) return execute();
    throw error;
  });
  await savePaymentAttempt(resourceKey, { kind: "settled", ...result });
  await savePaymentAttempt(input.attemptId, { kind: "settled", ...result });
  return result;
}
