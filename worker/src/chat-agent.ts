import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import {
  convertToModelMessages,
  streamText,
  type GenerateTextOnFinishCallback,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
} from "ai";

import { createChatModel } from "./model";

export function streamChatTurn({
  abortSignal,
  env,
  messages,
  model,
  onFinish,
}: {
  abortSignal?: AbortSignal;
  env: Env;
  messages: ModelMessage[];
  model?: LanguageModel;
  onFinish?: GenerateTextOnFinishCallback<ToolSet>;
}) {
  return streamText({
    model: model ?? createChatModel(env),
    system: "You are a helpful chat assistant. Keep answers concise.",
    messages,
    abortSignal,
    onFinish,
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
    });
  }
}
