import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import { Icon } from "@/components/icon";
import type { X402CallState } from "./types";

export function X402Call({ state }: { state: X402CallState }) {
  const [expanded, setExpanded] = useState(false);
  const label = state.kind === "running" || state.kind === "waiting" ? state.label : state.kind === "completed" ? "x402 · Paid" : "x402 · Couldn’t complete";
  return (
    <View className="mb-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        className="self-start flex-row items-center gap-2 rounded-full bg-muted px-3 py-2 active:opacity-60"
      >
        <Icon icon={expanded ? ChevronDown : ChevronRight} className="w-4 h-4 text-muted-foreground" />
        {state.kind === "running" && <ActivityIndicator size="small" />}
        <Text accessibilityLiveRegion="polite" className="text-sm text-muted-foreground">{label}</Text>
      </Pressable>
      {expanded && (
        <View className="rounded-xl bg-muted p-3 gap-3">
          {state.kind === "completed" ? <>
            <Text selectable className="text-xs text-muted-foreground">{state.result.url}</Text>
            <Text selectable className="text-xs font-mono text-foreground">{state.result.body}</Text>
            <Text selectable className="text-xs text-muted-foreground">Transaction: {state.result.signature}</Text>
          </> : <Text selectable className="text-xs text-muted-foreground">{state.kind === "error" ? state.message : state.label}</Text>}
        </View>
      )}
    </View>
  );
}
