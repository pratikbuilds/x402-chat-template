import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import { callable } from "agents";
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
  X402SettlementReportSchema,
  x402SettlementStorageKey,
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
      "You are a helpful chat assistant. Keep answers concise. Never claim that an x402 payment was sent or settled unless a tool result status is settled. When status is settled, present paidBody as the purchased resource. When the user asks to fetch a paid x402 resource or a random fact from debugger.pay.sh, call request_x402_payment exactly once with resourceUrl https://debugger.pay.sh/x402/fact, network solana:devnet, asset USDC, amountAtomic 1000, recipient 9uxcaSK4sSeaYacfCnzRuUyVe5jyvKaoYsZb7hMPEUMe, and reason Get a random paid fact.",
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
          findSettlement: async (toolCallId) => {
            const stored = await this.ctx.storage.get<{
              paidBody?: string;
              signature: string;
            }>(x402SettlementStorageKey(toolCallId));
            return stored?.signature
              ? {
                  paidBody: stored.paidBody ?? "",
                  signature: stored.signature,
                }
              : null;
          },
        }),
      },
    });
  }

  async recordX402Settlement(input: unknown) {
    const parsed = X402SettlementReportSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error("Invalid x402 settlement report.");
    }

    await this.ctx.storage.put(
      x402SettlementStorageKey(parsed.data.toolCallId),
      {
        paidBody: parsed.data.paidBody,
        request: parsed.data.request,
        signature: parsed.data.signature,
        settledAt: Date.now(),
        toolCallId: parsed.data.toolCallId,
      },
    );

    return {
      paidBody: parsed.data.paidBody,
      signature: parsed.data.signature,
      status: "settled" as const,
    };
  }

  async findX402Settlement(input: unknown) {
    if (typeof input !== "string" || input.length === 0) {
      throw new Error("Invalid toolCallId.");
    }

    const stored = await this.ctx.storage.get<{
      paidBody?: string;
      signature: string;
    }>(x402SettlementStorageKey(input));

    if (!stored?.signature) {
      return null;
    }

    return {
      paidBody: stored.paidBody ?? "",
      signature: stored.signature,
      status: "settled" as const,
    };
  }
}

// wrangler/esbuild does not transform TC39 decorators; mark the RPC methods directly.
callable()(ChatAgent.prototype.recordX402Settlement, undefined as never);
callable()(ChatAgent.prototype.findX402Settlement, undefined as never);
