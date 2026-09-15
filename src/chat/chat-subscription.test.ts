import { expect, test } from "bun:test";
import { Chat } from "@ai-sdk/react";

test("replacing a subscription during notification does not loop", () => {
  const chat = new Chat({});
  let calls = 0;
  let unsubscribe = () => {};
  const onChange = () => {
    calls++;
    if (calls > 3) throw new Error("Subscription notification loop");
    unsubscribe();
    unsubscribe = chat["~registerMessagesCallback"](onChange);
  };
  unsubscribe = chat["~registerMessagesCallback"](onChange);
  try {
    chat.messages = [{ id: "one", role: "user", parts: [{ type: "text", text: "Hello" }] }];
    expect(calls).toBe(1);
  } finally {
    unsubscribe();
  }
});
