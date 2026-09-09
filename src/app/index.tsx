import { ChatContent } from "@/chat/chat-content";
import { CloudflareChatScreen } from "@/chat/cloudflare-chat-screen";
import { isMockChatEnabled } from "@/chat/config";
import { MockChatScreen } from "@/chat/mock-chat-screen";

const USE_MOCK = isMockChatEnabled(process.env.EXPO_PUBLIC_MOCK_AI);

export default function ChatScreen() {
  if (USE_MOCK) {
    return <MockChatScreen />;
  }

  return (
    <CloudflareChatScreen render={(chat) => <ChatContent chat={chat} />} />
  );
}
