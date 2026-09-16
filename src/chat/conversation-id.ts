import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

const CONVERSATION_ID_STORAGE_KEY = "@chat/conversation-id";

type ConversationIdStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export function createConversationId() {
  return `conversation-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function isConversationId(value: unknown): value is string {
  return typeof value === "string" && /^conversation-[a-z0-9-]+$/i.test(value);
}

export async function getOrCreateConversationId(
  storage: ConversationIdStorage = AsyncStorage,
) {
  const storedConversationId = await storage.getItem(CONVERSATION_ID_STORAGE_KEY);
  if (isConversationId(storedConversationId)) {
    return storedConversationId;
  }

  const conversationId = createConversationId();
  await storage.setItem(CONVERSATION_ID_STORAGE_KEY, conversationId);
  return conversationId;
}

export function useConversationId() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const { conversationId: requestedConversationId } =
    useLocalSearchParams<{ conversationId?: string }>();

  useEffect(() => {
    let isMounted = true;
    setConversationId(null);

    const nextConversationId = isConversationId(requestedConversationId)
      ? Promise.resolve(requestedConversationId)
      : getOrCreateConversationId();

    nextConversationId
      .then(async (nextConversationId) => {
        if (isConversationId(requestedConversationId)) {
          await AsyncStorage.setItem(
            CONVERSATION_ID_STORAGE_KEY,
            requestedConversationId,
          );
        }
        return nextConversationId;
      })
      .then((nextConversationId) => {
        if (isMounted) {
          setConversationId(nextConversationId);
        }
      })
      .catch(() => {
        if (isMounted) {
          setConversationId(createConversationId());
        }
      });

    return () => {
      isMounted = false;
    };
  }, [requestedConversationId]);

  return conversationId;
}
