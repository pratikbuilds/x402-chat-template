import type { KeyPairSigner } from "@solana/kit";

import type { PrivyKitSigner } from "./privy-kit-signer";

let pendingVerified402: { response: Response; url: string } | null = null;
let payKitFetchShimInstalled = false;

export function getSolanaRpcUrl(
  value = process.env.EXPO_PUBLIC_SOLANA_RPC_URL,
) {
  if (!value) {
    throw new Error("EXPO_PUBLIC_SOLANA_RPC_URL is not set.");
  }

  return value;
}

export function queueVerified402(url: string, response: Response) {
  pendingVerified402 = { response: response.clone(), url };
}

export function clearVerified402() {
  pendingVerified402 = null;
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.href;
  }

  if (input instanceof Request) {
    return input.url;
  }

  return String(input);
}

function installPayKitFetchShim() {
  if (payKitFetchShimInstalled) {
    return;
  }

  const nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, init) => {
    const url = requestUrl(input);
    if (pendingVerified402 && url === pendingVerified402.url) {
      const response = pendingVerified402.response;
      pendingVerified402 = null;
      return response;
    }

    return nativeFetch(input, init);
  };
  payKitFetchShimInstalled = true;
}

export async function createPaidFetch(input: {
  rpcUrl: string;
  signer: PrivyKitSigner;
}) {
  installPayKitFetchShim();

  // pay-kit pulls Node crypto + viem; evaluating it during app boot overflows Hermes.
  const { createPayKitClient } = await import("@solana/pay-kit/client");

  return createPayKitClient({
    accept: ["x402"],
    rpcUrl: input.rpcUrl,
    signer: input.signer as KeyPairSigner,
  });
}
