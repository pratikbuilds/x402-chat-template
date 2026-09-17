import { ActivityIndicator, Text, View } from "react-native";

import type { AgentActivityState } from "./types";

export function AgentActivity({ state }: { state: AgentActivityState }) {
  return (
    <View className="mb-3 self-start flex-row items-center gap-2 rounded-full bg-muted px-3 py-2">
      {state.status === "running" && <ActivityIndicator size="small" colorClassName="accent-muted-foreground" />}
      <Text selectable className="text-sm text-muted-foreground">{state.label}</Text>
    </View>
  );
}
