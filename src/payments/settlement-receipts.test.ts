import { describe, expect, it } from "bun:test";

import {
  loadPaymentReceipt,
  parsePaymentReceipt,
  savePaymentReceipt,
  settlementReceiptStorageKey,
} from "./settlement-receipts";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    async getItem(key: string) {
      return data.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}

describe("payment receipts", () => {
  it("stores a completed payment", async () => {
    const storage = memoryStorage();
    const attempt = {
      url: "https://provider.example/fact",
      paidBody: '{"fact":"hello"}',
      signature: "5HjgkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYz11111",
    };

    await savePaymentReceipt("tool-call-1", attempt, storage);

    await expect(
      loadPaymentReceipt("tool-call-1", storage),
    ).resolves.toEqual(attempt);
    expect(storage.data.has(settlementReceiptStorageKey("tool-call-1"))).toBe(
      true,
    );
  });

  it("fails closed on malformed storage", () => {
    expect(parsePaymentReceipt({ signature: "receipt" })).toBeNull();
    expect(parsePaymentReceipt("nope")).toBeNull();
  });
});
