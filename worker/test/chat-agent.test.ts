import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { describe, expect, it } from "vitest";

import { streamChatTurn } from "../src/chat-agent";

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
