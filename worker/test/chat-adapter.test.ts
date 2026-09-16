import { describe, expect, it } from "vitest";

import {
  projectChatMessages,
  toChatError,
} from "../../src/chat/chat-adapter";
import { isMockChatEnabled } from "../../src/chat/config";
import {
  CHAT_AGENT_NAME,
  DEFAULT_CLOUDFLARE_AGENT_HOST,
  createCloudflareChatConnection,
} from "../../src/chat/cloudflare-connection";

describe("Cloudflare chat adapter", () => {
  it("starts with an empty projected history", () => {
    expect(projectChatMessages([], false)).toEqual([]);
  });

  it("projects streamed and finalized Agent messages", () => {
    const messages = [
      {
        id: "user-1",
        role: "user" as const,
        parts: [{ type: "text" as const, text: "Hello" }],
      },
      {
        id: "assistant-1",
        role: "assistant" as const,
        parts: [{ type: "text" as const, text: "Hello from the Agent" }],
      },
    ];

    expect(projectChatMessages(messages, true)).toEqual([
      { id: "user-1", role: "user", content: "Hello" },
      { id: "assistant-1", role: "assistant", content: "" },
    ]);
    expect(projectChatMessages(messages, false)).toEqual([
      { id: "user-1", role: "user", content: "Hello" },
      {
        id: "assistant-1",
        role: "assistant",
        content: "Hello from the Agent",
      },
    ]);
  });

  it("shows a failed x402 tool call instead of dropping it from the chat", () => {
    const messages = [{
      id: "assistant-payment-error",
      role: "assistant" as const,
      parts: [{
        type: "tool-request_x402_payment" as const,
        toolCallId: "payment-call",
        toolName: "request_x402_payment",
        state: "output-error" as const,
        input: {
          resourceUrl: "https://provider.example/quote",
          reason: "Get a quote",
        },
        errorText: "Payment endpoint returned HTTP 502 without settlement confirmation.",
      }],
    }];

    expect(projectChatMessages(messages, false)).toEqual([
      {
        id: "assistant-payment-error-payment-call-error",
        role: "assistant",
        content: "x402 call failed: Payment endpoint returned HTTP 502 without settlement confirmation.",
      },
    ]);
  });

  it("reuses the conversation instance for reconnects", () => {
    const conversationId = "conversation-durable-123";
    const initialConnection = createCloudflareChatConnection(
      conversationId,
      DEFAULT_CLOUDFLARE_AGENT_HOST,
    );
    const reconnectedConnection = createCloudflareChatConnection(
      conversationId,
      DEFAULT_CLOUDFLARE_AGENT_HOST,
    );

    expect(initialConnection).toEqual({
      agent: CHAT_AGENT_NAME,
      host: DEFAULT_CLOUDFLARE_AGENT_HOST,
      name: conversationId,
    });
    expect(reconnectedConnection).toEqual(initialConnection);
  });

  it("keeps mock mode on its local chat path", () => {
    expect(isMockChatEnabled("1")).toBe(true);
    expect(isMockChatEnabled(undefined)).toBe(false);
  });

  it("normalizes connection failures for the shared chat context", () => {
    expect(toChatError("Worker unavailable")).toEqual(
      new Error("Worker unavailable"),
    );
  });
});

it("keeps raw payment data out of visible message text", () => {
  const data = { url: "https://example.com", body: '{"bid":100}', signature: "receipt" };
  expect(projectChatMessages([{
    id: "paid", role: "user", parts: [
      { type: "text", text: "Call this endpoint" },
      { type: "data-x402", data },
    ],
  }], false)).toEqual([
    { id: "paid", role: "user", content: "Call this endpoint" },
    { id: "paid-x402", role: "assistant", content: "", x402: data },
  ]);
});
