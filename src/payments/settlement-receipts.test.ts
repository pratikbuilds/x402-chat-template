import { describe, expect, it } from "bun:test";

import {
  loadPaymentAttempt,
  parsePaymentAttemptRecord,
  savePaymentAttempt,
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

describe("payment attempt receipts", () => {
  it("round-trips a settled receipt by toolCallId", async () => {
    const storage = memoryStorage();
    const attempt = {
      kind: "settled" as const,
      paidBody: '{"fact":"hello"}',
      signature: "5HjgkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYz11111",
    };

    await savePaymentAttempt("tool-call-1", attempt, storage);

    await expect(
      loadPaymentAttempt("tool-call-1", storage),
    ).resolves.toEqual(attempt);
    expect(storage.data.has(settlementReceiptStorageKey("tool-call-1"))).toBe(
      true,
    );
  });

  it("round-trips an unknown attempt so retries stay blocked", async () => {
    const storage = memoryStorage();
    await savePaymentAttempt("tool-call-2", { kind: "unknown" }, storage);

    await expect(loadPaymentAttempt("tool-call-2", storage)).resolves.toEqual({
      kind: "unknown",
    });
  });

  it("fails closed on malformed storage", () => {
    expect(parsePaymentAttemptRecord({ kind: "settled" })).toBeNull();
    expect(parsePaymentAttemptRecord("nope")).toBeNull();
  });
});
