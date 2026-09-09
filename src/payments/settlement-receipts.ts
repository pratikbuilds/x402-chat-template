import AsyncStorage from "@react-native-async-storage/async-storage";

const RECEIPT_STORAGE_PREFIX = "@chat/x402-receipt:";

type ReceiptStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export type PaymentAttemptRecord =
  | { kind: "settled"; paidBody: string; signature: string }
  | { kind: "unknown" };

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
  if (record.kind === "unknown") {
    return { kind: "unknown" };
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
