import "fast-text-encoding";
import "react-native-get-random-values";
import "@ethersproject/shims";
import "event-target-polyfill";
import { Buffer } from "buffer";

globalThis.Buffer ??= Buffer;

// Solana Kit uses Web Crypto for account-address derivation.
if (process.env.EXPO_OS !== "web" && !globalThis.crypto?.subtle?.digest) {
  const { digest, CryptoDigestAlgorithm } =
    require("expo-crypto") as typeof import("expo-crypto");
  const subtle = globalThis.crypto.subtle ?? {};
  Object.defineProperty(subtle, "digest", {
    value: (algorithm: string | { name: string }, data: BufferSource) => {
      const name = typeof algorithm === "string" ? algorithm : algorithm.name;
      if (name !== "SHA-256") throw new Error(`Unsupported digest: ${name}`);
      return digest(CryptoDigestAlgorithm.SHA256, data);
    },
  });
  if (!globalThis.crypto.subtle)
    Object.defineProperty(globalThis.crypto, "subtle", { value: subtle });
}

if (typeof globalThis.MessageEvent === "undefined") {
  // partysocket cloneEventNode constructs MessageEvent in React Native.
  globalThis.MessageEvent = class MessageEvent extends Event {
    data: unknown;
    origin: string;
    lastEventId: string;

    constructor(
      type: string,
      init: { data?: unknown; origin?: string; lastEventId?: string } = {},
    ) {
      super(type);
      this.data = init.data;
      this.origin = init.origin ?? "";
      this.lastEventId = init.lastEventId ?? "";
    }
  } as unknown as typeof MessageEvent;
}

if (typeof globalThis.CloseEvent === "undefined") {
  // partysocket cloneEventNode constructs CloseEvent in React Native.
  globalThis.CloseEvent = class CloseEvent extends Event {
    code: number;
    reason: string;
    wasClean: boolean;

    constructor(
      typeOrCode: string | number,
      initOrReason?:
        { code?: number; reason?: string; wasClean?: boolean } | string,
      _event?: unknown,
    ) {
      if (typeof typeOrCode === "number") {
        super("close");
        this.code = typeOrCode;
        this.reason = typeof initOrReason === "string" ? initOrReason : "";
        this.wasClean = false;
        return;
      }

      super(typeOrCode);
      const init =
        typeof initOrReason === "object" && initOrReason ? initOrReason : {};
      this.code = init.code ?? 0;
      this.reason = init.reason ?? "";
      this.wasClean = init.wasClean ?? false;
    }
  } as unknown as typeof CloseEvent;
}

if (typeof globalThis.ErrorEvent === "undefined") {
  // partysocket cloneEventNode constructs ErrorEvent in React Native.
  globalThis.ErrorEvent = class ErrorEvent extends Event {
    error: unknown;
    message: string;

    constructor(
      typeOrError: string | unknown,
      init?: { error?: unknown; message?: string },
    ) {
      if (typeof typeOrError !== "string") {
        super("error");
        this.error = typeOrError;
        this.message = "";
        return;
      }

      super(typeOrError);
      this.error = init?.error;
      this.message = init?.message ?? "";
    }
  } as unknown as typeof ErrorEvent;
}

export function getSecureRandomnessError() {
  const randomValues = globalThis.crypto?.getRandomValues;

  if (typeof randomValues !== "function") {
    return "Secure randomness is unavailable on this device.";
  }

  try {
    const bytes = new Uint8Array(1);
    randomValues.call(globalThis.crypto, bytes);
    return null;
  } catch {
    return "Secure randomness is unavailable on this device.";
  }
}
