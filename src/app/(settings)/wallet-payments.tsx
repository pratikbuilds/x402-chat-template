import { getWalletStatusText, useWallet } from "@/wallet/wallet-provider";
import { CircleCheck, ShieldCheck, WalletCards } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";

type PrimaryAction = Readonly<{
  label: string;
  onPress: () => Promise<void>;
}>;

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function getPrimaryAction({
  connectExternalWallet,
  createEmbeddedWallet,
  signInWithSolana,
  state,
}: Pick<
  ReturnType<typeof useWallet>,
  | "connectExternalWallet"
  | "createEmbeddedWallet"
  | "signInWithSolana"
  | "state"
>): PrimaryAction | null {
  switch (state.kind) {
    case "external-wallet-disconnected":
      return { label: "Connect Solana wallet", onPress: connectExternalWallet };
    case "ready-to-sign-in":
      return { label: "Sign in with wallet", onPress: signInWithSolana };
    case "ready-to-create":
      return { label: "Create in-app wallet", onPress: createEmbeddedWallet };
    case "error":
      switch (state.action) {
        case "connect":
          return { label: "Try connecting again", onPress: connectExternalWallet };
        case "sign-in":
          return { label: "Try signing in again", onPress: signInWithSolana };
        case "create":
          return { label: "Try creating again", onPress: createEmbeddedWallet };
        case "disconnect":
          return null;
      }
    case "unavailable":
    case "loading":
    case "working":
    case "ready":
      return null;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export default function WalletPaymentsScreen() {
  const wallet = useWallet();
  const primaryAction = getPrimaryAction(wallet);
  const isWorking = wallet.state.kind === "working";

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-5 px-5 pt-5 pb-safe-offset-6"
    >
      <Text selectable className="text-[15px] leading-5 text-muted-foreground">
        Connect your Solana wallet to sign in. Chat creates a separate in-app wallet
        for future, explicitly approved payments.
      </Text>

      <WalletCard
        address={wallet.externalWalletAddress}
        icon={ShieldCheck}
        label="Connected wallet"
        status="Used only to sign in"
      />
      <WalletCard
        address={wallet.embeddedWalletAddress}
        icon={WalletCards}
        label="In-app wallet"
        status="Used for approved payments"
      />

      <View className="rounded-2xl bg-muted px-4 py-4 gap-2 border-continuous">
        <View className="flex-row items-center gap-2">
          <CircleCheck size={18} color="currentColor" />
          <Text selectable className="text-[16px] font-medium text-foreground">
            {wallet.state.kind === "ready" ? "Wallet ready" : "Set up wallet"}
          </Text>
        </View>
        <Text selectable className="text-[14px] leading-5 text-muted-foreground">
          {getWalletStatusText(wallet.state)}
        </Text>
      </View>

      {primaryAction ? (
        <Pressable
          accessibilityRole="button"
          className="items-center rounded-xl bg-foreground px-4 py-3.5 active:opacity-80"
          onPress={() => {
            void primaryAction.onPress();
          }}
        >
          <Text className="text-[16px] font-semibold text-background">
            {primaryAction.label}
          </Text>
        </Pressable>
      ) : null}

      {isWorking ? (
        <Text selectable className="px-4 py-3 text-center text-[14px] text-muted-foreground">
          Please finish the request in your wallet.
        </Text>
      ) : null}

      {wallet.state.kind === "ready" ? (
        <Pressable
          accessibilityRole="button"
          className="items-center rounded-xl border border-border px-4 py-3.5 active:bg-muted"
          onPress={() => {
            void wallet.disconnectWallets();
          }}
        >
          <Text className="text-[16px] font-semibold text-foreground">
            Disconnect wallets
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function WalletCard({
  address,
  icon: Icon,
  label,
  status,
}: {
  address: string | null;
  icon: LucideIcon;
  label: string;
  status: string;
}) {
  return (
    <View className="rounded-2xl border border-border px-4 py-4 gap-3 border-continuous">
      <View className="flex-row items-center gap-2">
        <Icon size={18} color="currentColor" />
        <Text selectable className="flex-1 text-[16px] font-medium text-foreground">
          {label}
        </Text>
        <Text selectable className="text-[13px] text-muted-foreground">
          {address ? "Connected" : "Not connected"}
        </Text>
      </View>
      <Text selectable className="text-[14px] text-muted-foreground">
        {address ? shortenAddress(address) : status}
      </Text>
    </View>
  );
}
