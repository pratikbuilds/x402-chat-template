import type { X402ChatResult } from "@/payments/x402-chat-result";
export type X402CallState =
  | { kind: "running"; label: string }
  | { kind: "waiting"; label: string }
  | { kind: "completed"; result: X402ChatResult }
  | { kind: "error"; message: string };
export type AgentActivityState = {
  label: string;
  status: "running" | "completed";
};
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  x402?: X402ChatResult;
  toolCall?: X402CallState;
  activity?: AgentActivityState;
};
