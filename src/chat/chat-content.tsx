import type { ChatAdapter } from "@/chat/chat-adapter";
import {
  ChatProvider,
  Conversation,
  ConversationEmptyState,
  ConversationScrollButton,
  Message,
  MessageResponse,
  PromptInput,
  PromptInputAction,
  PromptInputBody,
  PromptInputSubmit,
  PromptInputTextarea,
  StreamingMessage,
  type ChatMessage,
} from "@/components/chat";
import { Icon } from "@/components/icon";
import { MainHeader } from "@/components/main-header";
import { Link } from "expo-router";
import { Plus } from "lucide-react-native";
import { useCallback } from "react";
import { Pressable, Text, View } from "react-native";

export function ChatContent({ chat }: { chat: ChatAdapter }) {
  const { isGenerating, streamingStore } = chat;

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      if (item.role === "user") {
        return <Message from="user">{item.content}</Message>;
      }

      const isStreaming = isGenerating && item.content === "";
      return (
        <Message from="assistant">
          {isStreaming ? (
            <StreamingMessage store={streamingStore} />
          ) : (
            <MessageResponse>{item.content}</MessageResponse>
          )}
        </Message>
      );
    },
    [isGenerating, streamingStore],
  );

  return (
    <>
      <ChatProvider value={chat}>
        <Conversation
          renderMessage={renderMessage}
          emptyState={
            <ConversationEmptyState
              title="Chat"
              description="Send a message to get started"
            />
          }
        >
          <ConversationScrollButton />
          <PaymentApprovalCard
            approval={chat.approvals.at(-1)}
            onDecision={chat.approvePayment}
          />
          <PromptInput>
            <Link href="/attachments" asChild>
              <PromptInputAction>
                <Icon icon={Plus} className="w-5 h-5 text-muted-foreground" />
              </PromptInputAction>
            </Link>
            <PromptInputBody>
              <PromptInputTextarea />
              <PromptInputSubmit />
            </PromptInputBody>
          </PromptInput>
        </Conversation>
      </ChatProvider>
      <MainHeader />
    </>
  );
}

function PaymentApprovalCard({
  approval,
  onDecision,
}: {
  approval: ChatAdapter["approvals"][number] | undefined;
  onDecision: (id: string, approved: boolean) => void;
}) {
  if (!approval) {
    return null;
  }

  const details = getPaymentDetails(approval.input);

  return (
    <View className="absolute bottom-20 left-4 right-4 gap-3 rounded-2xl border border-border bg-background p-4 shadow-lg">
      <Text className="text-[16px] font-semibold text-foreground">
        Payment approval required
      </Text>
      {details ? (
        <View className="gap-1">
          <Text className="text-[14px] text-foreground">
            {details.amountAtomic} atomic USDC on {details.network}
          </Text>
          <Text numberOfLines={1} className="text-[13px] text-muted-foreground">
            Recipient: {details.recipient}
          </Text>
          <Text numberOfLines={2} className="text-[13px] text-muted-foreground">
            {details.reason}
          </Text>
        </View>
      ) : (
        <Text className="text-[14px] text-muted-foreground">
          Payment details could not be displayed safely. Decline this request.
        </Text>
      )}
      <View className="flex-row gap-2">
        <Pressable
          className="flex-1 items-center rounded-xl border border-border px-3 py-3 active:bg-muted"
          onPress={() => onDecision(approval.id, false)}
        >
          <Text className="font-semibold text-foreground">Decline</Text>
        </Pressable>
        <Pressable
          className="flex-1 items-center rounded-xl bg-foreground px-3 py-3 active:opacity-80"
          onPress={() => onDecision(approval.id, true)}
        >
          <Text className="font-semibold text-background">Approve request</Text>
        </Pressable>
      </View>
    </View>
  );
}

function getPaymentDetails(input: unknown) {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  if (
    !("amountAtomic" in input) ||
    !("network" in input) ||
    !("recipient" in input) ||
    !("reason" in input)
  ) {
    return null;
  }

  if (
    typeof input.amountAtomic !== "string" ||
    typeof input.network !== "string" ||
    typeof input.recipient !== "string" ||
    typeof input.reason !== "string"
  ) {
    return null;
  }

  return {
    amountAtomic: input.amountAtomic,
    network: input.network,
    reason: input.reason,
    recipient: input.recipient,
  };
}
