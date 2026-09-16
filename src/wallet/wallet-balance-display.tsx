import { useIsFocused } from "expo-router/react-navigation";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";

import { refreshWalletBalance, useWalletBalance } from "./balance-store";

export function WalletBalanceDisplay({ address }: { address: string }) {
  const { balances, refreshing, error } = useWalletBalance(address);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) void refreshWalletBalance(address);
  }, [address, isFocused]);

  return (
    <View className="flex-row items-center gap-3">
      <Text className="text-[12px] font-medium text-muted-foreground">
        Mainnet{error && balances ? " · Update failed" : ""}
      </Text>
      {balances ? (
        <View className="flex-1 flex-row gap-3">
          <Balance
            amount={balances.usdc}
            maximumFractionDigits={6}
            symbol="USDC"
          />
          <Balance
            amount={balances.sol}
            maximumFractionDigits={9}
            symbol="SOL"
          />
        </View>
      ) : (
        <Text
          accessibilityLiveRegion="polite"
          className="flex-1 text-[12px] text-muted-foreground"
        >
          {!error
            ? "Loading balances…"
            : "Couldn’t load balances. Tap Refresh to retry."}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Refresh wallet balances"
        disabled={refreshing}
        onPress={() => void refreshWalletBalance(address)}
        className="rounded-md px-2 py-1 active:bg-background disabled:opacity-50"
      >
        <Text className="text-[12px] font-medium text-foreground">{refreshing ? "Refreshing…" : "Refresh"}</Text>
      </Pressable>
    </View>
  );
}

function Balance({
  amount,
  maximumFractionDigits,
  symbol,
}: {
  amount: number;
  maximumFractionDigits: number;
  symbol: string;
}) {
  return (
    <View className="flex-row items-baseline gap-1">
      <Text selectable className="tabular-nums text-[14px] font-semibold text-foreground">
        {amount.toLocaleString(undefined, { maximumFractionDigits })}
      </Text>
      <Text className="text-[12px] font-medium text-muted-foreground">
        {symbol}
      </Text>
    </View>
  );
}
