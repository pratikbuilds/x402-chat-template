import { Link } from "expo-router";
import { ChevronDown, Wallet } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { useOptionalWallet } from "./wallet-provider";
import { useWalletBalance } from "./balance-store";

export function WalletBalanceChip() {
  const wallet = useOptionalWallet();
  if (!wallet) return null;
  return <View className="px-4 pt-1 bg-background">
    <Link href="/(settings)/wallet-payments" asChild>
      <Pressable accessibilityRole="button" accessibilityHint="Opens wallet balances and payment settings" className="self-start max-w-full min-h-8 flex-row items-center gap-3 rounded-lg active:bg-muted" hitSlop={6}>
        <Icon icon={Wallet} className="h-4 w-4 text-foreground" />
        {wallet.paymentWalletAddress ? <BalanceLabel address={wallet.paymentWalletAddress} /> : <Text className="shrink text-sm text-muted-foreground">Set up in-app wallet</Text>}
        <Icon icon={ChevronDown} className="h-4 w-4 text-muted-foreground" />
      </Pressable>
    </Link>
  </View>;
}
function BalanceLabel({ address }: { address: string }) {
  const { balances, refreshing, error } = useWalletBalance(address);
  return <Text accessibilityLiveRegion="polite" className="shrink text-sm text-muted-foreground">
    {balances ? <><Text className="text-foreground">{balances.usdc.toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC</Text>{` · ${balances.sol.toLocaleString(undefined, { maximumFractionDigits: 6 })} SOL`}</> : error ? "Balance unavailable" : "Loading…"}
    {balances && (refreshing ? " · Refreshing…" : error ? " · Update failed" : "")}
  </Text>;
}
