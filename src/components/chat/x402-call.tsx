import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import { Icon } from "@/components/icon";
import type { X402ChatResult } from "@/payments/x402-chat-result";

export function X402Call({ result }: { result: X402ChatResult }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View className="mb-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="x402 call"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        className="flex-row items-center gap-2 py-3 active:opacity-60"
      >
        <Icon icon={expanded ? ChevronDown : ChevronRight} className="w-4 h-4 text-muted-foreground" />
        <Text className="text-sm text-muted-foreground">x402 call · Completed</Text>
      </Pressable>
      {expanded && (
        <View className="rounded-xl bg-muted p-3 gap-3">
          <Text selectable className="text-xs text-muted-foreground">{result.url}</Text>
          <Text selectable className="text-xs font-mono text-foreground">{result.body}</Text>
          <Text selectable className="text-xs text-muted-foreground">Transaction: {result.signature}</Text>
        </View>
      )}
    </View>
  );
}
