export const X402_PAID_BODY_MAX_CHARS = 16_384;
export type SettleApprovedPaymentResult = {
  paidBody: string;
  signature: string;
};

export async function readSettledPayment(input: {
  pay: () => Promise<Response>;
}): Promise<SettleApprovedPaymentResult> {
  const response = await input.pay();
  const signature = tryReadSettlementSignature(response);
  if (!signature) {
    throw new Error(
      `Payment endpoint returned HTTP ${response.status} without settlement confirmation.`,
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
