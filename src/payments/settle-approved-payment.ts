import { z } from "zod";
import { AmbiguousPaymentError, PaymentRejectedError } from "./payment-errors";
import type { PaymentQuote } from "./x402-request";

export {
  AmbiguousPaymentError,
  isAmbiguousPaymentError,
} from "./payment-errors";
export const X402_PAID_BODY_MAX_CHARS = 16_384;
export type SettleApprovedPaymentResult = {
  paidBody: string;
  signature: string;
};

const endpointErrorSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
});

function describeEndpointResponse(body: string) {
  try {
    const result = endpointErrorSchema.safeParse(JSON.parse(body));
    if (result.success) {
      const detail = [result.data.error, result.data.message].filter(Boolean).join(": ");
      if (detail) return detail.slice(0, 1000);
    }
  } catch {
    // Some gateways return plain text or HTML errors.
  }
  return body.slice(0, 1000);
}

export async function settleApprovedPayment(input: {
  pay: () => Promise<Response>;
  quote: PaymentQuote;
}): Promise<SettleApprovedPaymentResult> {
  const response = await input.pay();
  const signature = tryReadSettlementSignature(response);
  if (!signature) {
    const body = await readPaidBody(response);
    const detail = describeEndpointResponse(body);
    if (response.status === 402) {
      try {
        const rejection = endpointErrorSchema.safeParse(JSON.parse(body));
        if (rejection.success && rejection.data.error === "Payment Invalid" && rejection.data.message?.startsWith("Payment verification failed.")) {
          throw new PaymentRejectedError(detail);
        }
      } catch (error) {
        if (error instanceof PaymentRejectedError) throw error;
      }
    }
    throw new AmbiguousPaymentError(
      `Payment endpoint returned HTTP ${response.status} without settlement confirmation.${detail ? ` Response: ${detail}` : ""} Do not pay again.`,
    );
  }
  return { paidBody: await readPaidBody(response), signature };
}

export function readSettlementSignature(response: Response) {
  const signature = tryReadSettlementSignature(response);
  if (!signature) {
    throw new Error("Paid response did not include a settlement signature.");
  }

  return signature;
}

function tryReadSettlementSignature(response: Response) {
  const header =
    response.headers.get("PAYMENT-RESPONSE") ??
    response.headers.get("X-PAYMENT-RESPONSE");

  if (!header) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeBase64Utf8(header));
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("success" in parsed) ||
    parsed.success !== true ||
    !("transaction" in parsed) ||
    typeof parsed.transaction !== "string" ||
    parsed.transaction.length === 0
  ) {
    return null;
  }

  return parsed.transaction;
}

async function readPaidBody(response: Response) {
  try {
    return (await response.text()).slice(0, X402_PAID_BODY_MAX_CHARS);
  } catch {
    return "Paid, but the response body could not be read.";
  }
}

function decodeBase64Utf8(value: string) {
  const binary = globalThis.atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
