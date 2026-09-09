import { createAnthropic } from "@ai-sdk/anthropic";
import { createWorkersAI } from "workers-ai-provider";
import type { LanguageModel } from "ai";

import { CHAT_AGENT_MODEL } from "./contracts";

type ChatModelEnv = {
  AI: Ai;
  ANTHROPIC_API_KEY?: string;
};

export function createChatModel(env: ChatModelEnv): LanguageModel {
  if (env.ANTHROPIC_API_KEY) {
    return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(
      "claude-haiku-4-5-20251001",
    );
  }

  const workersAI = createWorkersAI({ binding: env.AI });
  return workersAI(CHAT_AGENT_MODEL);
}
