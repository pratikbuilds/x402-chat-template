export const SOLANA_DEVNET_USDC_MINT =
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export type X402PaymentRequest = {
  amountAtomic: string;
  asset: "USDC";
  network: "solana:devnet";
  reason: string;
  recipient: string;
  resourceUrl: string;
};

export function parseX402PaymentRequest(
  input: unknown,
): X402PaymentRequest | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const record = input as Record<string, unknown>;
  if (
    typeof record.amountAtomic !== "string" ||
    record.asset !== "USDC" ||
    record.network !== "solana:devnet" ||
    typeof record.reason !== "string" ||
    typeof record.recipient !== "string" ||
    typeof record.resourceUrl !== "string"
  ) {
    return null;
  }

  if (!/^[1-9]\d*$/.test(record.amountAtomic)) {
    return null;
  }

  if (record.reason.trim().length === 0 || record.reason.length > 280) {
    return null;
  }

  if (record.recipient.length === 0 || record.recipient.length > 128) {
    return null;
  }

  try {
    if (new URL(record.resourceUrl).protocol !== "https:") {
      return null;
    }
  } catch {
    return null;
  }

  return {
    amountAtomic: record.amountAtomic,
    asset: "USDC",
    network: "solana:devnet",
    reason: record.reason,
    recipient: record.recipient,
    resourceUrl: record.resourceUrl,
  };
}

export type X402PaymentChallenge = {
  amountAtomic: string;
  asset: string;
  network: string;
  recipient: string;
};

export function parsePaymentRequiredHeader(
  header: string,
): X402PaymentChallenge | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(decodeBase64Utf8(header));
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const accepts = (parsed as { accepts?: unknown }).accepts;
  if (!Array.isArray(accepts) || accepts.length === 0) {
    return null;
  }

  return parsePaymentRequirement(accepts[0]);
}

export function parsePaymentRequirement(
  requirement: unknown,
): X402PaymentChallenge | null {
  if (typeof requirement !== "object" || requirement === null) {
    return null;
  }

  const record = requirement as Record<string, unknown>;
  const amountAtomic =
    typeof record.amount === "string"
      ? record.amount
      : typeof record.maxAmountRequired === "string"
        ? record.maxAmountRequired
        : null;

  if (
    amountAtomic === null ||
    typeof record.asset !== "string" ||
    typeof record.network !== "string" ||
    typeof record.payTo !== "string"
  ) {
    return null;
  }

  return {
    amountAtomic,
    asset: record.asset,
    network: record.network,
    recipient: record.payTo,
  };
}

export function normalizeX402Network(network: string) {
  switch (network) {
    case "solana:devnet":
    case "solana-devnet":
    case "devnet":
      return "solana:devnet";
    default:
      return network;
  }
}

export function matchApprovedChallenge(
  request: X402PaymentRequest,
  challenge: X402PaymentChallenge,
) {
  if (normalizeX402Network(challenge.network) !== request.network) {
    return { ok: false as const, reason: "network" };
  }

  if (challenge.recipient !== request.recipient) {
    return { ok: false as const, reason: "recipient" };
  }

  if (challenge.amountAtomic !== request.amountAtomic) {
    return { ok: false as const, reason: "amount" };
  }

  if (challenge.asset !== SOLANA_DEVNET_USDC_MINT) {
    return { ok: false as const, reason: "asset" };
  }

  return { ok: true as const };
}

function decodeBase64Utf8(value: string) {
  const binary = globalThis.atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
