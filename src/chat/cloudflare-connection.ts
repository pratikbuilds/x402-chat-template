export const CHAT_AGENT_NAME = "ChatAgent";
export const DEFAULT_CLOUDFLARE_AGENT_HOST = "http://127.0.0.1:8787";

export function createCloudflareChatConnection(
  conversationId: string,
  host = process.env.EXPO_PUBLIC_CLOUDFLARE_AGENT_HOST ??
    DEFAULT_CLOUDFLARE_AGENT_HOST,
) {
  return {
    agent: CHAT_AGENT_NAME,
    host,
    name: conversationId,
  };
}
