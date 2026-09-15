import { useOptionalWallet } from "@/wallet/wallet-provider";
import type { ChatAdapter } from "@/chat/chat-adapter";
import { useCloudflareChat } from "@/chat/cloudflare-chat";
import { useConversationId } from "@/chat/conversation-id";
import { createStreamingStore } from "@/components/chat/streaming-store";
import * as Haptics from "expo-haptics";
import { Component, Suspense, useCallback, useMemo, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";

function createErrorChatAdapter(error: Error): ChatAdapter {
  return {
    canSend: false,
    messages: [],
    input: "",
    setInput: () => {},
    isGenerating: false,
    isRecovering: false,
    onSend: () => {},
    stop: () => {},
    streamingStore: createStreamingStore(),
    error,
  };
}

function createLoadingChatAdapter(): ChatAdapter {
  return {
    canSend: false,
    messages: [],
    input: "",
    setInput: () => {},
    isGenerating: false,
    isRecovering: false,
    onSend: () => {},
    stop: () => {},
    streamingStore: createStreamingStore(),
    error: null,
  };
}

class CloudflareChatErrorBoundary extends Component<
  {
    children: ReactNode;
    conversationId: string;
    render: (chat: ChatAdapter) => ReactNode;
  },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prevProps: { conversationId: string }) {
    if (prevProps.conversationId !== this.props.conversationId && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return this.props.render(createErrorChatAdapter(this.state.error));
    }

    return this.props.children;
  }
}

export function CloudflareChatScreen({
  render,
}: {
  render: (chat: ChatAdapter) => ReactNode;
}) {
  const conversationId = useConversationId();
  const wallet = useOptionalWallet();
  const loadingAdapter = useMemo(() => createLoadingChatAdapter(), []);

  if (!conversationId || wallet?.state.kind === "loading") {
    return (
      <>
        {render(loadingAdapter)}
        <View className="absolute inset-0 items-center justify-center">
          <ActivityIndicator />
        </View>
      </>
    );
  }

  return (
    <CloudflareChatErrorBoundary conversationId={conversationId} render={render}>
      <Suspense
        fallback={
          <>
            {render(loadingAdapter)}
            <View className="absolute inset-0 items-center justify-center">
              <ActivityIndicator />
            </View>
          </>
        }
      >
        <CloudflareChatContent conversationId={conversationId} render={render} />
      </Suspense>
    </CloudflareChatErrorBoundary>
  );
}

function CloudflareChatContent({
  conversationId,
  render,
}: {
  conversationId: string;
  render: (chat: ChatAdapter) => ReactNode;
}) {
  const onBeforeSend = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);
  const chat = useCloudflareChat({ conversationId, onBeforeSend });

  return render(chat);
}
