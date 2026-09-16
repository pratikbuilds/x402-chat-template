import { useDeferredValue, useSyncExternalStore } from "react";
import { Text } from "react-native";
import { ChatMarkdown } from "@/components/markdown";
import type { StreamingStore } from "./streaming-store";

export function StreamingMessage({ store }: { store: StreamingStore }) {
  const text = useSyncExternalStore(store.subscribe, store.get);
  const renderedText = useDeferredValue(text);
  return renderedText ? <ChatMarkdown>{renderedText}</ChatMarkdown> : <Text accessibilityLiveRegion="polite" className="text-muted-foreground">Thinking…</Text>;
}
