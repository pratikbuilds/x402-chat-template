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
import { parseX402PaymentRequest } from "@/payments/x402-request";
import {
  getWalletStatusText,
  useOptionalWallet,
} from "@/wallet/wallet-provider";
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

  const pendingApproval = chat.approvals.at(-1);

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
            approval={pendingApproval}
            canSettlePayment={chat.canSettlePayment}
            onDecision={chat.approvePayment}
            settlement={chat.paymentSettlement}
          />
          {chat.paymentSettlement.status === "settled" &&
          (!pendingApproval ||
            pendingApproval.id === chat.paymentSettlement.approvalId) ? (
            <View className="absolute bottom-20 left-4 right-4 gap-2 rounded-2xl border border-border bg-background p-4 shadow-lg">
              <Text className="text-[16px] font-semibold text-foreground">
                Payment settled
              </Text>
              <Text selectable className="text-[13px] text-muted-foreground">
                {chat.paymentSettlement.signature}
              </Text>
            </View>
          ) : null}
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
  canSettlePayment,
  onDecision,
  settlement,
}: {
  approval: ChatAdapter["approvals"][number] | undefined;
  canSettlePayment: boolean;
  onDecision: (id: string, approved: boolean) => void;
  settlement: ChatAdapter["paymentSettlement"];
}) {
  const wallet = useOptionalWallet();
  const canPay = canSettlePayment && wallet?.state.kind === "ready";

  if (
    !approval ||
    (settlement.status === "settled" && settlement.approvalId === approval.id)
  ) {
    return null;
  }

  const details = parseX402PaymentRequest(approval.input);
  const isPaying =
    settlement.status === "paying" && settlement.approvalId === approval.id;
  const isBlocked =
    settlement.status === "blocked" && settlement.approvalId === approval.id;
  const failureMessage =
    (settlement.status === "blocked" || settlement.status === "failed") &&
    settlement.approvalId === approval.id
      ? settlement.message
      : null;
  const walletHint =
    canSettlePayment && !canPay
      ? wallet
        ? getWalletStatusText(wallet.state)
        : "Wallet is not available."
      : null;

  return (
    <View className="absolute bottom-20 left-4 right-4 gap-3 rounded-2xl border border-border bg-background p-4 shadow-lg">
      <Text className="text-[16px] font-semibold text-foreground">
        Payment approval required
      </Text>
      {details ? (
        <View className="gap-1">
          <Text className="text-[14px] text-foreground">
            {details.amountAtomic} atomic {details.asset} on {details.network}
          </Text>
          <Text numberOfLines={1} className="text-[13px] text-muted-foreground">
            {details.resourceUrl}
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
      {walletHint ? (
        <Text className="text-[13px] text-muted-foreground">{walletHint}</Text>
      ) : null}
      {failureMessage ? (
        <Text className="text-[13px] text-muted-foreground">{failureMessage}</Text>
      ) : null}
      <View className="flex-row gap-2">
        <Pressable
          className="flex-1 items-center rounded-xl border border-border px-3 py-3 active:bg-muted"
          disabled={isPaying}
          onPress={() => onDecision(approval.id, false)}
        >
          <Text className="font-semibold text-foreground">Decline</Text>
        </Pressable>
        {canPay && !isBlocked ? (
          <Pressable
            className="flex-1 items-center rounded-xl bg-foreground px-3 py-3 active:opacity-80"
            disabled={isPaying}
            onPress={() => onDecision(approval.id, true)}
          >
            <Text className="font-semibold text-background">
              {isPaying ? "Paying…" : "Approve request"}
            </Text>
          </Pressable>
        ) : canSettlePayment && !isBlocked ? (
          <Link href="/(settings)/wallet-payments" asChild>
            <Pressable className="flex-1 items-center rounded-xl bg-foreground px-3 py-3 active:opacity-80">
              <Text className="font-semibold text-background">Set up wallet</Text>
            </Pressable>
          </Link>
        ) : null}
      </View>
    </View>
  );
}
