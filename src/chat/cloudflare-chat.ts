import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useCallback } from "react";

import { isAmbiguousPaymentError } from "@/payments/payment-errors";
import {
  loadPaymentAttempt,
  parsePaymentAttemptRecord,
  savePaymentAttempt,
  type PaymentAttemptRecord,
} from "@/payments/settlement-receipts";
import { parseX402PaymentRequest } from "@/payments/x402-request";
import { useOptionalWallet } from "@/wallet/wallet-provider";

import { useChatAdapter } from "./chat-adapter";
import { createCloudflareChatConnection } from "./cloudflare-connection";

export { isMockChatEnabled } from "./config";
export {
  CHAT_AGENT_NAME,
  DEFAULT_CLOUDFLARE_AGENT_HOST,
  createCloudflareChatConnection,
} from "./cloudflare-connection";

type CloudflareChatOptions = {
  conversationId: string;
  onBeforeSend?: (text: string) => void;
};

export function useCloudflareChat({
  conversationId,
  onBeforeSend,
}: CloudflareChatOptions) {
  const agent = useAgent(createCloudflareChatConnection(conversationId));
  const chat = useAgentChat({ agent, resume: true });
  const wallet = useOptionalWallet();
  const canSettleOnThisPlatform = process.env.EXPO_OS === "android";

  const lookupPaymentAttempt = useCallback(async (toolCallId: string) => {
    const local = await loadPaymentAttempt(toolCallId);
    if (local) {
      return local;
    }

    try {
      const remote = await agent.call("findX402Settlement", [toolCallId]);
      const parsed = parseRemoteSettlement(remote);
      if (parsed) {
        await savePaymentAttempt(toolCallId, parsed);
      }
      return parsed;
    } catch {
      return null;
    }
  }, [agent]);

  const settlePayment = useCallback(
    async ({
      request,
      toolCallId,
    }: {
      request: unknown;
      toolCallId: string;
    }) => {
      const parsed = parseX402PaymentRequest(request);
      if (!parsed) {
        throw new Error("Payment details could not be displayed safely.");
      }

      if (
        wallet?.state.kind !== "ready" ||
        !wallet.embeddedWalletAddress ||
        !wallet.getEmbeddedSolanaProvider
      ) {
        throw new Error("The in-app wallet is not ready to pay.");
      }

      const provider = await wallet.getEmbeddedSolanaProvider();
      if (!provider) {
        throw new Error("The in-app wallet is not ready to pay.");
      }

      const [
        { createPaidFetch, getSolanaRpcUrl },
        { createPrivyKitSigner },
        { settleApprovedPayment },
      ] = await Promise.all([
        import("@/payments/paid-fetch"),
        import("@/payments/privy-kit-signer"),
        import("@/payments/settle-approved-payment"),
      ]);
      const client = await createPaidFetch({
        rpcUrl: getSolanaRpcUrl(),
        signer: createPrivyKitSigner({
          provider,
          walletAddress: wallet.embeddedWalletAddress,
        }),
      });

      try {
        const result = await settleApprovedPayment({
          pay: (resourceUrl) => client.fetch(resourceUrl, undefined, "x402"),
          request: parsed,
        });
        await savePaymentAttempt(toolCallId, {
          kind: "settled",
          paidBody: result.paidBody,
          signature: result.signature,
        });
        return result;
      } catch (error) {
        if (isAmbiguousPaymentError(error)) {
          await savePaymentAttempt(toolCallId, { kind: "unknown" });
        }
        throw error;
      }
    },
    [wallet],
  );

  const recordSettlement = useCallback(
    async ({
      paidBody,
      request,
      signature,
      toolCallId,
    }: {
      paidBody: string;
      request: unknown;
      signature: string;
      toolCallId: string;
    }) => {
      const parsed = parseX402PaymentRequest(request);
      if (!parsed) {
        throw new Error("Payment details could not be displayed safely.");
      }

      await agent.call("recordX402Settlement", [
        {
          paidBody,
          request: parsed,
          signature,
          toolCallId,
        },
      ]);
    },
    [agent],
  );

  return useChatAdapter({
    onBeforeSend,
    transport: {
      addToolApprovalResponse: chat.addToolApprovalResponse,
      error: chat.error ?? chat.connectionError ?? agent.connectionError,
      isRecovering: chat.isRecovering,
      isStreaming: chat.isStreaming,
      lookupPaymentAttempt: canSettleOnThisPlatform
        ? lookupPaymentAttempt
        : undefined,
      messages: chat.messages,
      sendMessage: chat.sendMessage,
      settlePayment: canSettleOnThisPlatform ? settlePayment : undefined,
      recordSettlement: canSettleOnThisPlatform ? recordSettlement : undefined,
      status: chat.status,
      stop: chat.stop,
    },
  });
}

function parseRemoteSettlement(value: unknown): PaymentAttemptRecord | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.status !== "settled") {
    return null;
  }

  return parsePaymentAttemptRecord({
    kind: "settled",
    paidBody: typeof record.paidBody === "string" ? record.paidBody : "",
    signature: record.signature,
  });
}
