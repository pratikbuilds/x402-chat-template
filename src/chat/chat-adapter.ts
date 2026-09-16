import { X402ChatResultSchema } from "../payments/x402-chat-result";
import type { UIMessage } from "ai";
import { useEffect, useMemo, useState } from "react";
import { createStreamingStore, type StreamingStore } from "../components/chat/streaming-store";
import type { ChatMessage } from "../components/chat/types";

export type ChatStatus = "ready" | "submitted" | "streaming" | "error";
export type ChatTransport = {
  error: unknown;
  isRecovering: boolean;
  isStreaming: boolean;
  messages: UIMessage[];
  sendMessage: (message: { text: string }) => void;
  status: ChatStatus;
  stop: () => void;
};
export type ChatAdapter = {
  canSend: boolean;
  error: Error | null;
  input: string;
  isGenerating: boolean;
  isRecovering: boolean;
  messages: ChatMessage[];
  onSend: () => void;
  setInput: (value: string) => void;
  stop: () => void;
  streamingStore: StreamingStore;
};
function getTextFromParts(parts: UIMessage["parts"]) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function projectChatMessages(
  messages: UIMessage[],
  isStreaming: boolean,
) {
  return messages.flatMap((message, index): ChatMessage[] => {
    if (message.role !== "user" && message.role !== "assistant") {
      return [];
    }

    const isActiveAssistantMessage =
      isStreaming &&
      message.role === "assistant" &&
      index === messages.length - 1;

    const results: ChatMessage[] = message.parts.flatMap((part) => {
      if (part.type === "data-x402") {
        const parsed = X402ChatResultSchema.safeParse(part.data);
        return parsed.success
          ? [{ id: `${message.id}-x402`, role: "assistant", content: "", x402: parsed.data }]
          : [];
      }
      if (
        part.type === "tool-request_x402_payment" &&
        part.state === "output-error"
      ) {
        return [{
          id: `${message.id}-${part.toolCallId}-error`,
          role: "assistant",
          content: `x402 call failed: ${part.errorText ?? "The payment request could not be completed."}`,
        }];
      }
      return [];
    });
    const text = getTextFromParts(message.parts);
    if (!text && !isActiveAssistantMessage) return results;

    return [
      {
        id: message.id,
        role: message.role,
        content: isActiveAssistantMessage
          ? ""
          : text,
      },
      ...results,
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

export function useChatAdapter({ onBeforeSend, transport }: {
  onBeforeSend?: (text: string) => void;
  transport: ChatTransport;
}): ChatAdapter {
  const [input, setInput] = useState("");
  const streamingStore = useMemo(() => createStreamingStore(), []);
  const isGenerating = transport.status === "submitted" || transport.isStreaming || transport.isRecovering;
  useEffect(() => {
    const last = transport.messages.at(-1);
    streamingStore.set(transport.isStreaming && last?.role === "assistant" ? getTextFromParts(last.parts) : "");
  }, [streamingStore, transport.isStreaming, transport.messages]);
  return {
    canSend: !isGenerating,
    messages: projectChatMessages(transport.messages, transport.isStreaming),
    input,
    setInput,
    isGenerating,
    isRecovering: transport.isRecovering,
    onSend: () => {
      const text = input.trim();
      if (!text || isGenerating) return;
      onBeforeSend?.(text);
      transport.sendMessage({ text });
      setInput("");
    },
    stop: transport.stop,
    streamingStore,
    error: toChatError(transport.error),
  };
}
