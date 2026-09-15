import type { KeyPairSigner } from "@solana/kit";
import type { PrivyKitSigner } from "./privy-kit-signer";

export function getSolanaRpcUrl(
  value = process.env.EXPO_PUBLIC_SOLANA_RPC_URL,
) {
  if (!value) throw new Error("EXPO_PUBLIC_SOLANA_RPC_URL is not set.");
  return value;
}

export async function createPaidFetch(input: {
  rpcUrl: string;
  signer: PrivyKitSigner;
}) {
  const { createPayKitClient } = await import("@solana/pay-kit/client");

  return createPayKitClient({
    accept: ["x402"],
    rpcUrl: input.rpcUrl,
    signer: input.signer as KeyPairSigner,
  });
}
