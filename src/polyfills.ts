import "event-target-polyfill";

type CryptoTypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Uint8ClampedArray;

declare const global: typeof globalThis;

if (typeof globalThis.MessageEvent === "undefined") {
  class MessageEventPolyfill extends Event {
    readonly data: unknown;

    constructor(type: string, init?: MessageEventInit) {
      super(type, init);
      this.data = init?.data;
    }
  }

  const MessageEventImpl =
    MessageEventPolyfill as unknown as typeof MessageEvent;

  globalThis.MessageEvent = MessageEventImpl;
  global.MessageEvent = MessageEventImpl;
}

function insecureGetRandomValues(array: CryptoTypedArray) {
  for (let index = 0; index < array.length; index += 1) {
    array[index] = Math.floor(Math.random() * 256);
  }
  return array;
}

function insecureRandomUUID() {
  const bytes = new Uint8Array(16);
  insecureGetRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

if (typeof globalThis.crypto?.getRandomValues !== "function") {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      getRandomValues: insecureGetRandomValues as Crypto["getRandomValues"],
      randomUUID: insecureRandomUUID as Crypto["randomUUID"],
    } satisfies Pick<Crypto, "getRandomValues" | "randomUUID">,
  });
} else if (typeof globalThis.crypto.randomUUID !== "function") {
  try {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      writable: true,
      value: insecureRandomUUID,
    });
  } catch {
    // Some runtimes expose crypto as read-only; getRandomValues is enough for nanoid.
  }
}
