import { address, type SignatureBytes } from "@solana/kit";
import { describe, expect, it, mock } from "bun:test";

import {
  createPrivyKitSigner,
  type PrivySolanaSignProvider,
} from "./privy-kit-signer";

const WALLET = "11111111111111111111111111111111";

describe("createPrivyKitSigner", () => {
  it("does not wrap a CryptoKeyPair", () => {
    const signer = createPrivyKitSigner({
      provider: {
        request: async () => {
          throw new Error("unused");
        },
      } as unknown as PrivySolanaSignProvider,
      walletAddress: WALLET,
    });

    expect(signer.address).toBe(address(WALLET));
    expect("keyPair" in signer).toBe(false);
  });

  it("signs messages without broadcasting", async () => {
    const signature = new Uint8Array(64).fill(7);
    const request = mock(async (args: { method: string }) => {
      expect(args.method).toBe("signMessage");
      return { signature: Buffer.from(signature).toString("base64") };
    }) as unknown as PrivySolanaSignProvider["request"];
    const signer = createPrivyKitSigner({
      provider: { request },
      walletAddress: WALLET,
    });

    await expect(
      signer.signMessages([
        { content: new TextEncoder().encode("hello"), signatures: {} },
      ]),
    ).resolves.toEqual([{ [address(WALLET)]: signature as SignatureBytes }]);
  });

  it("asks Privy to signTransaction rather than signAndSendTransaction", async () => {
    const methods: string[] = [];
    const signer = createPrivyKitSigner({
      provider: {
        request: async (args) => {
          methods.push(args.method);
          throw new Error("stop after method check");
        },
      } as PrivySolanaSignProvider,
      walletAddress: WALLET,
    });

    await signer
      .signTransactions([
        {
          messageBytes: new Uint8Array(32) as never,
          signatures: { [address(WALLET)]: null },
        } as never,
      ])
      .catch(() => undefined);

    expect(methods.every((method) => method !== "signAndSendTransaction")).toBe(
      true,
    );
  });
});
