import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

type ChatMessagesFrame = {
  messages: unknown[];
  type: "cf_agent_chat_messages";
};

function waitForChatMessages(socket: WebSocket) {
  return new Promise<ChatMessagesFrame>((resolve) => {
    socket.addEventListener("message", (event) => {
      const frame: unknown = JSON.parse(String(event.data));
      if (
        typeof frame === "object" &&
        frame !== null &&
        "type" in frame &&
        frame.type === "cf_agent_chat_messages" &&
        "messages" in frame &&
        Array.isArray(frame.messages)
      ) {
        resolve({ type: "cf_agent_chat_messages", messages: frame.messages });
      }
    });
  });
}

async function connectToChat(instance: string) {
  const response = await SELF.fetch(`https://example.com/agents/chat-agent/${instance}`, {
    headers: { Upgrade: "websocket" },
  });
  const socket = response.webSocket;

  if (socket === null) {
    throw new Error("The Agent route did not upgrade to a WebSocket.");
  }

  socket.accept();
  return socket;
}

describe("development Worker entrypoint", () => {
  it("reports health without invoking the Agent route", async () => {
    const response = await SELF.fetch("https://example.com/health");

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("answers CORS preflight requests", async () => {
    const response = await SELF.fetch("https://example.com/agents/chat-agent/test", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:8081",
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:8081",
    );
  });

  it("isolates updates between named Agent instances", async () => {
    const firstWriter = await connectToChat("first-instance");
    const firstObserver = await connectToChat("first-instance");
    const secondInstance = await connectToChat("second-instance");
    const firstMessages = waitForChatMessages(firstObserver);
    let secondInstanceReceivedMessages = false;
    secondInstance.addEventListener("message", (event) => {
      const frame: unknown = JSON.parse(String(event.data));
      if (
        typeof frame === "object" &&
        frame !== null &&
        "type" in frame &&
        frame.type === "cf_agent_chat_messages"
      ) {
        secondInstanceReceivedMessages = true;
      }
    });

    firstWriter.send(
      JSON.stringify({
        type: "cf_agent_chat_messages",
        messages: [
          {
            id: "first-user-message",
            role: "user",
            parts: [{ type: "text", text: "First conversation" }],
          },
        ],
      }),
    );

    await expect(firstMessages).resolves.toMatchObject({
      messages: [{ id: "first-user-message" }],
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(secondInstanceReceivedMessages).toBe(false);
  });
});
