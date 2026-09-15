import AsyncStorage from "@react-native-async-storage/async-storage";

const RECEIPT_STORAGE_PREFIX = "@chat/x402-receipt:";

type ReceiptStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export type PaymentAttemptRecord =
  | { kind: "settled"; paidBody: string; signature: string }
  | { kind: "unknown" }
  | { kind: "rejected" };

export function settlementReceiptStorageKey(toolCallId: string) {
  return `${RECEIPT_STORAGE_PREFIX}${toolCallId}`;
}

export async function loadPaymentAttempt(
  toolCallId: string,
  storage: ReceiptStorage = AsyncStorage,
): Promise<PaymentAttemptRecord | null> {
  const stored = await storage.getItem(settlementReceiptStorageKey(toolCallId));
  if (!stored) {
    return null;
  }

  try {
    return parsePaymentAttemptRecord(JSON.parse(stored));
  } catch {
    return null;
  }
}

export async function savePaymentAttempt(
  toolCallId: string,
  attempt: PaymentAttemptRecord,
  storage: ReceiptStorage = AsyncStorage,
) {
  await storage.setItem(
    settlementReceiptStorageKey(toolCallId),
    JSON.stringify(attempt),
  );
}

export function parsePaymentAttemptRecord(
  value: unknown,
): PaymentAttemptRecord | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.kind === "unknown" || record.kind === "rejected") {
    return { kind: record.kind };
  }

  if (
    record.kind === "settled" &&
    typeof record.signature === "string" &&
    record.signature.length > 0 &&
    typeof record.paidBody === "string"
  ) {
    return {
      kind: "settled",
      paidBody: record.paidBody,
      signature: record.signature,
    };
  }

  return null;
}

export function paymentResourceKey(wallet: string, url: string) {
  return `resource:${JSON.stringify([wallet, new URL(url).href])}`;
}

export async function assertPaymentResourceAvailable(
  wallet: string,
  url: string,
  storage: ReceiptStorage = AsyncStorage,
) {
  const key = paymentResourceKey(wallet, url);
  const stored = await storage.getItem(settlementReceiptStorageKey(key));
  if (stored !== null) {
    const record = parsePaymentAttemptRecord(JSON.parse(stored));
    if (!record || record.kind === "unknown") {
      throw new Error("A previous payment to this endpoint is unconfirmed. Check its settlement before paying again.");
    }
  }
  return key;
}
