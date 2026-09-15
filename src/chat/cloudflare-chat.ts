import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useRef, useState } from "react";
import { payForResource } from "@/payments/pay-for-resource";
import { useOptionalWallet } from "@/wallet/wallet-provider";
import { useChatAdapter } from "./chat-adapter";
import { createCloudflareChatConnection } from "./cloudflare-connection";
import { getPaidRequest } from "./paid-request";

export { isMockChatEnabled } from "./config";
export { CHAT_AGENT_NAME, DEFAULT_CLOUDFLARE_AGENT_HOST, createCloudflareChatConnection } from "./cloudflare-connection";

export function useCloudflareChat({ conversationId, onBeforeSend }: {
  conversationId: string;
  onBeforeSend?: (text: string) => void;
}) {
  const agent = useAgent(createCloudflareChatConnection(conversationId));
  const wallet = useOptionalWallet();
  const chat = useAgentChat({ agent, resume: true });
  const paying = useRef(false);
  const [isPaying, setIsPaying] = useState(false);

  const sendMessage = async ({ text }: { text: string }) => {
    chat.clearError();
    const request = getPaidRequest(text);
    if (!request) {
      await chat.sendMessage({ text });
      return;
    }
    if (paying.current) return;
    paying.current = true;
    setIsPaying(true);
    const id = `payment-${Date.now()}`;
    chat.setMessages((messages) => [...messages, {
      id: `${id}-user`, role: "user", parts: [{ type: "text", text }],
    }]);
    try {
      if (!wallet?.getPaymentSigner) throw new Error("Connect your in-app wallet first.");
      const response = await payForResource({ request, attemptId: id, getSigner: wallet.getPaymentSigner });
      await chat.sendMessage({
        messageId: `${id}-user`,
        role: "user",
        parts: [
          { type: "text", text },
          { type: "data-x402", data: { url: request.resourceUrl, body: response.paidBody, signature: response.signature } },
        ],
      });
    } catch (error) {
      chat.setMessages((messages) => [...messages, {
        id: `${id}-error`, role: "assistant", parts: [{
          type: "text", text: error instanceof Error ? error.message : "Payment failed.",
        }],
      }]);
    } finally {
      paying.current = false;
      setIsPaying(false);
    }
  };

  return useChatAdapter({
    onBeforeSend,
    transport: {
      error: chat.error ?? chat.connectionError ?? agent.connectionError,
      isRecovering: chat.isRecovering,
      isStreaming: chat.isStreaming || isPaying,
      messages: chat.messages,
      sendMessage,
      status: chat.status,
      stop: chat.stop,
    },
  });
}
