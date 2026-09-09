import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";

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

  return useChatAdapter({
    onBeforeSend,
    transport: {
      error: chat.error ?? chat.connectionError ?? agent.connectionError,
      isRecovering: chat.isRecovering,
      isStreaming: chat.isStreaming,
      messages: chat.messages,
      sendMessage: chat.sendMessage,
      status: chat.status,
      stop: chat.stop,
    },
  });
}
