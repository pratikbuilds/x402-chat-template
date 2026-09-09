import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createStreamingStore, type StreamingStore } from "../components/chat/streaming-store";
import type { ChatMessage } from "../components/chat/types";
import { isAmbiguousPaymentError } from "../payments/payment-errors";
import type { SettleApprovedPaymentResult } from "../payments/settle-approved-payment";
import type { PaymentAttemptRecord } from "../payments/settlement-receipts";

export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

export type ChatTransport = {
  addToolApprovalResponse: (response: { approved: boolean; id: string }) => void;
  error: unknown;
  isRecovering: boolean;
  isStreaming: boolean;
  lookupPaymentAttempt?: (
    toolCallId: string,
  ) => Promise<PaymentAttemptRecord | null>;
  messages: UIMessage[];
  sendMessage: (message: { text: string }) => void;
  settlePayment?: (input: {
    id: string;
    request: unknown;
    toolCallId: string;
  }) => Promise<SettleApprovedPaymentResult>;
  recordSettlement?: (input: {
    id: string;
    paidBody: string;
    request: unknown;
    signature: string;
    toolCallId: string;
  }) => Promise<void>;
  status: ChatStatus;
  stop: () => void;
};

export type ChatPaymentApproval = Readonly<{
  id: string;
  input: unknown;
  toolCallId: string;
}>;

type UseChatAdapterOptions = {
  onBeforeSend?: (text: string) => void;
  transport: ChatTransport;
};

export type PaymentSettlement =
  | { status: "idle" }
  | { status: "paying"; approvalId: string }
  | { status: "settled"; approvalId: string; signature: string }
  | { status: "failed"; approvalId: string; message: string }
  | { status: "blocked"; approvalId: string; message: string };

export type ChatAdapter = {
  approvePayment: (id: string, approved: boolean) => void;
  approvals: ChatPaymentApproval[];
  canSettlePayment: boolean;
  error: Error | null;
  input: string;
  isGenerating: boolean;
  isRecovering: boolean;
  messages: ChatMessage[];
  onSend: () => void;
  paymentSettlement: PaymentSettlement;
  setInput: (value: string) => void;
  stop: () => void;
  streamingStore: StreamingStore;
};

export function projectChatPaymentApprovals(messages: UIMessage[]) {
  return messages.flatMap((message): ChatPaymentApproval[] =>
    message.parts.flatMap((part) => {
      if (
        !isToolUIPart(part) ||
        getToolName(part) !== "request_x402_payment" ||
        part.state !== "approval-requested"
      ) {
        return [];
      }

      return [
        {
          id: part.approval.id,
          input: part.input,
          toolCallId: part.toolCallId,
        },
      ];
    }),
  );
}

function getTextFromParts(parts: UIMessage["parts"]) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function projectChatMessages(messages: UIMessage[], isStreaming: boolean) {
  return messages.flatMap((message, index): ChatMessage[] => {
    if (message.role !== "user" && message.role !== "assistant") {
      return [];
    }

    const isActiveAssistantMessage =
      isStreaming &&
      message.role === "assistant" &&
      index === messages.length - 1;

    return [
      {
        id: message.id,
        role: message.role,
        content: isActiveAssistantMessage ? "" : getTextFromParts(message.parts),
      },
    ];
  });
}

export function toChatError(error: unknown) {
  if (error === null || error === undefined) {
    return null;
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

export function useChatAdapter({
  onBeforeSend,
  transport,
}: UseChatAdapterOptions): ChatAdapter {
  const [input, setInput] = useState("");
  const [paymentSettlement, setPaymentSettlement] = useState<PaymentSettlement>(
    { status: "idle" },
  );
  const attempts = useRef(new Map<string, PaymentAttemptRecord>());
  const payingApprovalId = useRef<string | null>(null);
  const streamingStore = useMemo(() => createStreamingStore(), []);
  const previousStreamingText = useRef("");
  const isGenerating =
    transport.status === "submitted" ||
    transport.isStreaming ||
    transport.isRecovering;

  const messages = useMemo(
    () => projectChatMessages(transport.messages, transport.isStreaming),
    [transport.isStreaming, transport.messages],
  );
  const approvals = useMemo(
    () => projectChatPaymentApprovals(transport.messages),
    [transport.messages],
  );

  useEffect(() => {
    if (!transport.isStreaming) {
      if (previousStreamingText.current) {
        previousStreamingText.current = "";
        streamingStore.set("");
      }
      return;
    }

    const lastMessage = transport.messages.at(-1);
    if (lastMessage?.role !== "assistant") {
      return;
    }

    const text = getTextFromParts(lastMessage.parts);
    if (text !== previousStreamingText.current) {
      previousStreamingText.current = text;
      streamingStore.set(text);
    }
  }, [streamingStore, transport.isStreaming, transport.messages]);

  const onSend = useCallback(() => {
    const text = input.trim();
    if (!text || isGenerating) {
      return;
    }

    onBeforeSend?.(text);
    transport.sendMessage({ text });
    setInput("");
  }, [input, isGenerating, onBeforeSend, transport]);

  const approvePayment = useCallback(
    (id: string, approved: boolean) => {
      if (!approved) {
        payingApprovalId.current = null;
        setPaymentSettlement({ status: "idle" });
        transport.addToolApprovalResponse({ approved: false, id });
        return;
      }

      const settlePayment = transport.settlePayment;
      if (!settlePayment) {
        transport.addToolApprovalResponse({ approved: true, id });
        return;
      }

      if (payingApprovalId.current === id) {
        return;
      }

      const approval = projectChatPaymentApprovals(transport.messages).find(
        (item) => item.id === id,
      );
      if (!approval) {
        setPaymentSettlement({
          approvalId: id,
          message: "Payment details could not be found.",
          status: "failed",
        });
        return;
      }

      const finishAfterRecord = async (receipt: {
        paidBody: string;
        signature: string;
      }) => {
        attempts.current.set(id, { kind: "settled", ...receipt });
        setPaymentSettlement({
          approvalId: id,
          signature: receipt.signature,
          status: "settled",
        });

        if (transport.recordSettlement) {
          try {
            await transport.recordSettlement({
              id,
              paidBody: receipt.paidBody,
              request: approval.input,
              signature: receipt.signature,
              toolCallId: approval.toolCallId,
            });
          } catch {
            payingApprovalId.current = null;
            setPaymentSettlement({
              approvalId: id,
              message:
                "Paid, but the receipt could not be saved. Tap Approve to retry without paying again.",
              status: "failed",
            });
            return;
          }
        }

        payingApprovalId.current = null;
        transport.addToolApprovalResponse({ approved: true, id });
      };

      const resolveAttempt = async () => {
        const cached = attempts.current.get(id);
        if (cached) {
          return cached;
        }

        const stored = await transport.lookupPaymentAttempt?.(
          approval.toolCallId,
        );
        if (stored) {
          attempts.current.set(id, stored);
        }
        return stored ?? null;
      };

      payingApprovalId.current = id;
      setPaymentSettlement({ approvalId: id, status: "paying" });

      void (async () => {
        const existing = await resolveAttempt();
        if (existing?.kind === "settled") {
          await finishAfterRecord(existing);
          return;
        }
        if (existing?.kind === "unknown") {
          payingApprovalId.current = null;
          setPaymentSettlement({
            approvalId: id,
            message:
              "Payment may already have been sent. Do not approve again.",
            status: "blocked",
          });
          return;
        }

        try {
          const result = await settlePayment({
            id,
            request: approval.input,
            toolCallId: approval.toolCallId,
          });
          await finishAfterRecord(result);
        } catch (error: unknown) {
          payingApprovalId.current = null;
          if (isAmbiguousPaymentError(error)) {
            attempts.current.set(id, { kind: "unknown" });
            setPaymentSettlement({
              approvalId: id,
              message:
                toChatError(error)?.message ??
                "Payment may already have been sent. Do not approve again.",
              status: "blocked",
            });
            return;
          }

          setPaymentSettlement({
            approvalId: id,
            message: toChatError(error)?.message ?? "Payment failed.",
            status: "failed",
          });
        }
      })();
    },
    [transport],
  );

  return {
    approvePayment,
    approvals,
    canSettlePayment: Boolean(transport.settlePayment),
    messages,
    input,
    setInput,
    isGenerating,
    isRecovering: transport.isRecovering,
    onSend,
    paymentSettlement,
    stop: transport.stop,
    streamingStore,
    error: toChatError(transport.error),
  };
}
