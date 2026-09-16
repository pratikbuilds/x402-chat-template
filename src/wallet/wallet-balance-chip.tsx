import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useOptionalWallet } from "./wallet-provider";
import { useWalletBalance } from "./balance-store";

export function WalletBalanceChip() {
  const wallet = useOptionalWallet();
  if (!wallet) return null;
  return <View className="px-4 py-2 bg-background">
    <Link href="/(settings)/wallet-payments" asChild>
      <Pressable accessibilityRole="button" accessibilityLabel="In-app wallet and balances" className="self-start rounded-full bg-muted px-3 py-2 active:opacity-60">
        {wallet.paymentWalletAddress ? <BalanceLabel address={wallet.paymentWalletAddress} /> : <Text className="text-xs text-muted-foreground">Set up in-app wallet</Text>}
      </Pressable>
    </Link>
  </View>;
}
function BalanceLabel({ address }: { address: string }) {
  const { balances, refreshing, error } = useWalletBalance(address);
  return <Text accessibilityLiveRegion="polite" className="text-xs text-muted-foreground">
    In-app wallet · {balances ? `${balances.usdc.toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC · ${balances.sol.toLocaleString(undefined, { maximumFractionDigits: 6 })} SOL` : error ? "Balance unavailable" : "Loading…"}
    {balances && (refreshing ? " · Refreshing…" : error ? " · Update failed" : "")}
  </Text>;
}
