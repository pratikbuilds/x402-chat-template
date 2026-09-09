import type { UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type UseChatAdapterOptions = {
  onBeforeSend?: (text: string) => void;
  transport: ChatTransport;
};

export type ChatAdapter = {
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

  return {
    messages,
    input,
    setInput,
    isGenerating,
    isRecovering: transport.isRecovering,
    onSend,
    stop: transport.stop,
    streamingStore,
    error: toChatError(transport.error),
  };
}
