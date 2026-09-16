import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useRef, useState } from "react";
import { payForResource } from "@/payments/pay-for-resource";
import { parseX402PaymentRequest } from "@/payments/x402-request";
import { useOptionalWallet } from "@/wallet/wallet-provider";
import { useChatAdapter } from "./chat-adapter";
import { createCloudflareChatConnection } from "./cloudflare-connection";

export { isMockChatEnabled } from "./config";
export { CHAT_AGENT_NAME, DEFAULT_CLOUDFLARE_AGENT_HOST, createCloudflareChatConnection } from "./cloudflare-connection";

export function useCloudflareChat({ conversationId, onBeforeSend }: {
  conversationId: string;
  onBeforeSend?: (text: string) => void;
}) {
  const agent = useAgent(createCloudflareChatConnection(conversationId));
  const wallet = useOptionalWallet();
  const paying = useRef(false);
  const [isPaying, setIsPaying] = useState(false);
  const chat = useAgentChat({
    agent,
    resume: true,
    onToolCall: async ({ toolCall, addToolOutput }) => {
      if (toolCall.toolName !== "request_x402_payment") return;

      const request = parseX402PaymentRequest(toolCall.input);
      if (!request) {
        addToolOutput({
          toolCallId: toolCall.toolCallId,
          state: "output-error",
          errorText: "The payment tool received an invalid HTTPS endpoint.",
        });
        return;
      }
      if (paying.current) {
        addToolOutput({
          toolCallId: toolCall.toolCallId,
          state: "output-error",
          errorText: "Another x402 payment is already awaiting completion.",
        });
        return;
      }

      paying.current = true;
      setIsPaying(true);
      try {
        if (!wallet?.getPaymentSigner) {
          throw new Error("Connect your in-app wallet first.");
        }
        const response = await payForResource({
          request,
          attemptId: toolCall.toolCallId,
          getSigner: wallet.getPaymentSigner,
        });
        addToolOutput({
          toolCallId: toolCall.toolCallId,
          output: {
            url: request.resourceUrl,
            body: response.paidBody,
            signature: response.signature,
          },
        });
      } catch (error) {
        addToolOutput({
          toolCallId: toolCall.toolCallId,
          state: "output-error",
          errorText: error instanceof Error ? error.message : "Payment failed.",
        });
      } finally {
        paying.current = false;
        setIsPaying(false);
      }
    },
  });

  const sendMessage = async ({ text }: { text: string }) => {
    chat.clearError();
    await chat.sendMessage({ text });
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
