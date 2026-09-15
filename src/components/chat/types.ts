import type { X402ChatResult } from "@/payments/x402-chat-result";
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  x402?: X402ChatResult;
};
