import { useIsFocused } from "expo-router/react-navigation";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { getWalletBalances } from "./wallet-balances";

type BalanceState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; balances: Awaited<ReturnType<typeof getWalletBalances>> };

export function WalletBalanceDisplay({ address }: { address: string }) {
  const [state, setState] = useState<BalanceState>({ kind: "loading" });
  const [refresh, setRefresh] = useState(0);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused) return;
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    void getWalletBalances(address, controller.signal)
      .then(
        (balances) => {
          if (active) setState({ kind: "ready", balances });
        },
        () => {
          if (active) setState({ kind: "error" });
        },
      )
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [address, isFocused, refresh]);

  return (
    <View className="flex-row items-center gap-3">
      <Text className="text-[12px] font-medium text-muted-foreground">
        Mainnet
      </Text>
      {state.kind === "ready" ? (
        <View className="flex-1 flex-row gap-3">
          <Balance
            amount={state.balances.usdc}
            maximumFractionDigits={6}
            symbol="USDC"
          />
          <Balance
            amount={state.balances.sol}
            maximumFractionDigits={9}
            symbol="SOL"
          />
        </View>
      ) : (
        <Text
          accessibilityLiveRegion="polite"
          className="flex-1 text-[12px] text-muted-foreground"
        >
          {state.kind === "loading"
            ? "Loading balances…"
            : "Couldn’t load balances. Tap Refresh to retry."}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Refresh wallet balances"
        disabled={state.kind === "loading"}
        onPress={() => {
          setState({ kind: "loading" });
          setRefresh((value) => value + 1);
        }}
        className="rounded-md px-2 py-1 active:bg-background disabled:opacity-50"
      >
        <Text className="text-[12px] font-medium text-foreground">Refresh</Text>
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
