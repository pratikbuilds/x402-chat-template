import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { describe, expect, it } from "vitest";

import { prepareChatMessages, streamChatTurn } from "../src/chat-agent";

it("omits abandoned payment approvals while preserving completed payment results", async () => {
  const messages = await prepareChatMessages([
    {
      id: "interrupted",
      role: "assistant",
      parts: [{
        type: "tool-request_x402_payment",
        toolCallId: "abandoned",
        state: "approval-requested",
        input: { resourceUrl: "https://provider.example/fact", reason: "Get fact" },
        approval: { id: "approval-old" },
      }],
    },
    { id: "new", role: "user", parts: [{ type: "text", text: "Try another URL" }] },
    {
      id: "completed",
      role: "assistant",
      parts: [{
        type: "tool-request_x402_payment",
        toolCallId: "paid",
        state: "output-available",
        input: { resourceUrl: "https://provider.example/other", reason: "Get other" },
        output: { status: "settled", signature: "receipt", paidBody: "paid JSON" },
      }],
    },
  ]);
  expect(JSON.stringify(messages)).not.toContain("abandoned");
  expect(messages).toContainEqual({ role: "user", content: [{ type: "text", text: "Try another URL" }] });
  expect(JSON.stringify(messages)).toContain("paid JSON");
});

describe("streamChatTurn", () => {
  it("passes the Agent abort signal to the model stream", async () => {
    const controller = new AbortController();
    let receivedAbortSignal: AbortSignal | undefined;
    const chunks: LanguageModelV4StreamPart[] = [
      { type: "stream-start", warnings: [] },
      { type: "text-start", id: "response" },
      { type: "text-delta", id: "response", delta: "Test response" },
      { type: "text-end", id: "response" },
      {
        type: "finish",
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: {
            total: 1,
            noCache: 1,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 1,
            text: 1,
            reasoning: undefined,
          },
        },
      },
    ];
    const model = new MockLanguageModelV4({
      doStream: async ({ abortSignal }) => {
        receivedAbortSignal = abortSignal;

        return {
          stream: simulateReadableStream({
            chunks: [...chunks],
          }),
        };
      },
    });

    const response = streamChatTurn({
      abortSignal: controller.signal,
      env: { AI: {} as Ai },
      messages: [{ role: "user", content: "Hello" }],
      model,
    });

    await response.text();

    expect(receivedAbortSignal).toBe(controller.signal);
  });
});

it("passes collapsed x402 data to the model as endpoint context", async () => {
  const messages = await prepareChatMessages([{
    id: "paid", role: "user", parts: [
      { type: "text", text: "What is the BTC spread?" },
      { type: "data-x402", data: { url: "https://example.com/quote", body: '{"bid":100,"ask":102}', signature: "receipt" } },
    ],
  }]);
  const context = JSON.stringify(messages);
  expect(context).toContain("What is the BTC spread?");
  expect(context).toContain('bid');
  expect(context).toContain('102');
  expect(context).toContain("untrusted data");
  expect(context).toContain("receipt");
});
