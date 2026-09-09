import {
  address,
  getTransactionDecoder,
  getTransactionEncoder,
  type MessagePartialSigner,
  type SignatureBytes,
  type TransactionPartialSigner,
} from "@solana/kit";
import { VersionedTransaction } from "@solana/web3.js";

export type PrivySolanaSignProvider = {
  request(args: {
    method: "signTransaction";
    params: { transaction: VersionedTransaction };
  }): Promise<{ signedTransaction: VersionedTransaction }>;
  request(args: {
    method: "signMessage";
    params: { message: string };
  }): Promise<{ signature: string }>;
};

export type PrivyKitSigner = TransactionPartialSigner & MessagePartialSigner;

export function isPrivySolanaSignProvider(
  value: unknown,
): value is PrivySolanaSignProvider {
  return (
    typeof value === "object" &&
    value !== null &&
    "request" in value &&
    typeof value.request === "function"
  );
}

export function createPrivyKitSigner(input: {
  provider: PrivySolanaSignProvider;
  walletAddress: string;
}): PrivyKitSigner {
  const wallet = address(input.walletAddress);

  return {
    address: wallet,
    async signTransactions(transactions) {
      return Promise.all(
        transactions.map(async (transaction) => {
          const wireBytes = getTransactionEncoder().encode(transaction);
          const { signedTransaction } = await input.provider.request({
            method: "signTransaction",
            params: {
              transaction: VersionedTransaction.deserialize(
                Uint8Array.from(wireBytes),
              ),
            },
          });
          const signed = getTransactionDecoder().decode(
            toBytes(signedTransaction.serialize()),
          );
          const signature = signed.signatures[wallet];

          if (!signature) {
            throw new Error(
              "Privy signed the transaction without a signature for this wallet.",
            );
          }

          return { [wallet]: signature };
        }),
      );
    },
    async signMessages(messages) {
      return Promise.all(
        messages.map(async (message) => {
          const { signature } = await input.provider.request({
            method: "signMessage",
            params: {
              message: new TextDecoder().decode(message.content),
            },
          });

          return { [wallet]: decodeSignatureBytes(signature) };
        }),
      );
    },
  };
}

function toBytes(value: Uint8Array | number[] | ArrayBuffer): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  return Uint8Array.from(value);
}

function decodeSignatureBytes(value: string): SignatureBytes {
  try {
    const bytes = Uint8Array.from(globalThis.atob(value), (char) =>
      char.charCodeAt(0),
    );
    if (bytes.byteLength === 64) {
      return bytes as SignatureBytes;
    }
  } catch {
    return failInvalidSignature();
  }

  return failInvalidSignature();
}

function failInvalidSignature(): never {
  throw new Error("Privy returned a signature that was not 64 bytes.");
}
