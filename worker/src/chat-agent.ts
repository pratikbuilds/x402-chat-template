import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type GenerateTextOnFinishCallback,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
} from "ai";

import { createChatModel } from "./model";
import {
  createX402PaymentTool,
  X402_PAYMENT_TOOL_NAME,
} from "./x402-payment";

export function streamChatTurn({
  abortSignal,
  env,
  messages,
  model,
  onFinish,
  tools,
}: {
  abortSignal?: AbortSignal;
  env: Env;
  messages: ModelMessage[];
  model?: LanguageModel;
  onFinish?: GenerateTextOnFinishCallback<ToolSet>;
  tools?: ToolSet;
}) {
  return streamText({
    model: model ?? createChatModel(env),
    system:
      "You are a helpful chat assistant. Keep answers concise. Never claim that an x402 payment was sent or settled unless a tool result explicitly says so.",
    messages,
    abortSignal,
    onFinish,
    stopWhen: stepCountIs(3),
    tools,
  }).toUIMessageStreamResponse();
}

export class ChatAgent extends AIChatAgent<Env> {
  async onChatMessage(
    onFinish: GenerateTextOnFinishCallback<ToolSet>,
    options?: OnChatMessageOptions,
  ) {
    return streamChatTurn({
      env: this.env,
      messages: await convertToModelMessages(this.messages),
      abortSignal: options?.abortSignal,
      onFinish,
      tools: {
        [X402_PAYMENT_TOOL_NAME]: createX402PaymentTool({
          createApproval: async (request, expiresAt) => {
            const approvalId = crypto.randomUUID();
            await this.ctx.storage.put(`x402:approval:${approvalId}`, {
              approvalId,
              conversationId: this.name,
              createdAt: Date.now(),
              expiresAt,
              request,
              status: "approved_for_client_signing",
            });
            return { approvalId };
          },
        }),
      },
    });
  }
}
