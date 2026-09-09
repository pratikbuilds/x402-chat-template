import { AmbiguousPaymentError } from "./payment-errors";
import { clearVerified402, queueVerified402 } from "./paid-fetch";
import { attachPaymentRequiredHeader } from "./x402-fetch-compat";
import {
  matchApprovedChallenge,
  parsePaymentRequiredHeader,
  parsePaymentRequirement,
  type X402PaymentRequest,
} from "./x402-request";

export { AmbiguousPaymentError, isAmbiguousPaymentError } from "./payment-errors";

export const X402_PAID_BODY_MAX_CHARS = 16_384;

export type SettleApprovedPaymentResult = {
  paidBody: string;
  signature: string;
};

export async function settleApprovedPayment(input: {
  pay: (resourceUrl: string, verifiedResponse: Response) => Promise<Response>;
  probe?: typeof fetch;
  request: X402PaymentRequest;
}): Promise<SettleApprovedPaymentResult> {
  clearVerified402();
  const probe = input.probe ?? globalThis.fetch.bind(globalThis);
  const probeResponse = await probe(input.request.resourceUrl);

  if (probeResponse.status !== 402) {
    throw new Error("This URL did not require an x402 payment.");
  }

  const verifiedResponse = await attachPaymentRequiredHeader(probeResponse);
  const challenge = await readPaymentChallenge(verifiedResponse);
  const match = matchApprovedChallenge(input.request, challenge);

  if (!match.ok) {
    throw new Error(
      `The 402 challenge did not match the approved ${match.reason}.`,
    );
  }

  queueVerified402(input.request.resourceUrl, verifiedResponse);
  try {
    const paidResponse = await input.pay(
      input.request.resourceUrl,
      verifiedResponse,
    );
    const signature = tryReadSettlementSignature(paidResponse);
    const paidBody = await readPaidBody(paidResponse);

    if (signature) {
      return { paidBody, signature };
    }

    if (!paidResponse.ok) {
      throw new AmbiguousPaymentError(
        `Payment retry failed with HTTP ${paidResponse.status}. Do not retry; the payment may already be on-chain.`,
      );
    }

    throw new Error("Paid response did not include a settlement signature.");
  } finally {
    clearVerified402();
  }
}

async function readPaymentChallenge(response: Response) {
  const header =
    response.headers.get("PAYMENT-REQUIRED") ??
    response.headers.get("payment-required");
  if (header) {
    const challenge = parsePaymentRequiredHeader(header);
    if (challenge) {
      return challenge;
    }
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body: unknown = await response.clone().json();
    if (
      typeof body === "object" &&
      body !== null &&
      "accepts" in body &&
      Array.isArray(body.accepts)
    ) {
      const challenge = parsePaymentRequirement(body.accepts[0]);
      if (challenge) {
        return challenge;
      }
    }
  }

  throw new Error("402 was missing a payment challenge.");
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
    typeof (parsed as { transaction?: unknown }).transaction !== "string" ||
    (parsed as { transaction: string }).transaction.length === 0
  ) {
    return null;
  }

  return (parsed as { transaction: string }).transaction;
}

async function readPaidBody(response: Response) {
  try {
    return (await response.text()).slice(0, X402_PAID_BODY_MAX_CHARS);
  } catch {
    return "";
  }
}

function decodeBase64Utf8(value: string) {
  const binary = globalThis.atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
