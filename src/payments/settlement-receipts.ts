import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";

const RECEIPT_STORAGE_PREFIX = "@chat/x402-receipt:";

type ReceiptStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

const PaymentReceiptSchema = z.object({
  url: z.url(),
  paidBody: z.string(),
  signature: z.string().min(1),
});

export type PaymentReceipt = z.infer<typeof PaymentReceiptSchema>;

export function settlementReceiptStorageKey(toolCallId: string) {
  return `${RECEIPT_STORAGE_PREFIX}${toolCallId}`;
}

export async function loadPaymentReceipt(
  toolCallId: string,
  storage: ReceiptStorage = AsyncStorage,
): Promise<PaymentReceipt | null> {
  const stored = await storage.getItem(settlementReceiptStorageKey(toolCallId));
  if (!stored) {
    return null;
  }

  try {
    return parsePaymentReceipt(JSON.parse(stored));
  } catch {
    return null;
  }
}

export async function savePaymentReceipt(
  toolCallId: string,
  receipt: PaymentReceipt,
  storage: ReceiptStorage = AsyncStorage,
) {
  await storage.setItem(
    settlementReceiptStorageKey(toolCallId),
    JSON.stringify(receipt),
  );
}

export function parsePaymentReceipt(value: unknown): PaymentReceipt | null {
  const result = PaymentReceiptSchema.safeParse(value);
  return result.success ? result.data : null;
}
