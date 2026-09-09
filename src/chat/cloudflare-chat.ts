import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useCallback } from "react";

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

  const settlePayment = useCallback(
    async ({ request }: { id: string; request: unknown }) => {
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

      return settleApprovedPayment({
        pay: (resourceUrl) => client.fetch(resourceUrl, undefined, "x402"),
        request: parsed,
      });
    },
    [wallet],
  );

  const recordSettlement = useCallback(
    async ({
      request,
      signature,
      toolCallId,
    }: {
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
      messages: chat.messages,
      sendMessage: chat.sendMessage,
      settlePayment: canSettleOnThisPlatform ? settlePayment : undefined,
      recordSettlement: canSettleOnThisPlatform ? recordSettlement : undefined,
      status: chat.status,
      stop: chat.stop,
    },
  });
}
