import { getWalletStatusText, useWallet } from "@/wallet/wallet-provider";
import { WalletBalanceDisplay } from "@/wallet/wallet-balance-display";
import { payForResource } from "@/payments/pay-for-resource";
import * as Clipboard from "expo-clipboard";
import { Check, Copy, ShieldCheck, WalletCards } from "lucide-react-native";
import { useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

type WalletScreenAction = Readonly<{
  label: string;
  onPress: () => Promise<void>;
  variant?: "primary" | "secondary";
}>;

function formatAddress(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function getExternalAction(
  wallet: ReturnType<typeof useWallet>,
): WalletScreenAction | null {
  if (wallet.externalWalletAddress) {
    return {
      label:
        wallet.state.kind === "error" && wallet.state.action === "disconnect"
          ? "Try disconnecting again"
          : "Disconnect wallet",
      onPress: wallet.disconnectWallets,
      variant: "secondary",
    };
  }

  switch (wallet.state.kind) {
    case "external-wallet-disconnected":
      return {
        label: "Connect wallet",
        onPress: wallet.connectExternalWallet,
      };
    case "error":
      if (wallet.state.action === "connect") {
        return {
          label: "Try connecting again",
          onPress: wallet.connectExternalWallet,
        };
      }
      return null;
    case "ready-to-sign-in":
    case "ready-to-create":
    case "unavailable":
    case "loading":
    case "working":
    case "ready":
      return null;
    default: {
      const _exhaustive: never = wallet.state;
      return _exhaustive;
    }
  }
}

function getInAppAction(
  wallet: ReturnType<typeof useWallet>,
): WalletScreenAction | null {
  switch (wallet.state.kind) {
    case "ready-to-sign-in":
      return { label: "Sign in with wallet", onPress: wallet.signInWithSolana };
    case "ready-to-create":
      return {
        label: "Create in-app wallet",
        onPress: wallet.createEmbeddedWallet,
      };
    case "error":
      if (wallet.state.action === "sign-in") {
        return {
          label: "Try signing in again",
          onPress: wallet.signInWithSolana,
        };
      }
      if (wallet.state.action === "create") {
        return {
          label: "Try creating again",
          onPress: wallet.createEmbeddedWallet,
        };
      }
      return null;
    case "external-wallet-disconnected":
    case "unavailable":
    case "loading":
    case "working":
    case "ready":
      return null;
    default: {
      const _exhaustive: never = wallet.state;
      return _exhaustive;
    }
  }
}

function WalletActionButton({
  action,
  disabled,
}: {
  action: WalletScreenAction;
  disabled: boolean;
}) {
  const isSecondary = action.variant === "secondary";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      className={
        isSecondary
          ? "self-start rounded-md px-2 py-1.5 active:bg-muted disabled:opacity-50"
          : "items-center rounded-xl bg-foreground px-4 py-3.5 active:opacity-80 disabled:opacity-50"
      }
      disabled={disabled}
      onPress={() => {
        void action.onPress();
      }}
    >
      <Text
        className={
          isSecondary
            ? "text-[13px] font-medium text-foreground"
            : "text-[16px] font-semibold text-background"
        }
      >
        {action.label}
      </Text>
    </Pressable>
  );
}

export default function WalletPaymentsScreen() {
  const wallet = useWallet();
  const calling = useRef(false);
  const [result, setResult] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const callEndpoint = async () => {
    if (calling.current || !wallet.getPaymentSigner) return;
    calling.current = true;
    setIsCalling(true);
    setResult("");
    try {
      const response = await payForResource({
        request: { resourceUrl: "https://mcp.blocksize.info/v1/bidask/BTC-USD", reason: "Get BTC-USD bid and ask" },
        attemptId: `direct-${Date.now()}`,
        getSigner: wallet.getPaymentSigner,
      });
      setResult(`Paid successfully\n${response.signature}\n\n${response.paidBody}`);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Call failed.");
    } finally {
      calling.current = false;
      setIsCalling(false);
    }
  };
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const externalAction = getExternalAction(wallet);
  const inAppAction = getInAppAction(wallet);
  const isWorking = wallet.state.kind === "working";
  const inAppStatus = wallet.embeddedWalletAddress
    ? "Connected"
    : wallet.state.kind === "loading"
      ? "Loading"
      : wallet.state.kind === "unavailable"
        ? "Unavailable"
        : "Not connected";
  const externalStatus = wallet.externalWalletAddress
    ? "Connected"
    : wallet.state.kind === "loading"
      ? "Loading"
      : "Not connected";
  const externalError =
    wallet.state.kind === "error" &&
    (wallet.state.action === "connect" || wallet.state.action === "disconnect")
      ? getWalletStatusText(wallet.state)
      : null;
  const inAppError =
    wallet.state.kind === "error" &&
    (wallet.state.action === "sign-in" || wallet.state.action === "create")
      ? getWalletStatusText(wallet.state)
      : null;
  const statusMessage =
    wallet.state.kind === "working" || wallet.state.kind === "unavailable"
      ? getWalletStatusText(wallet.state)
      : null;
  const copyAddress = async (address: string) => {
    await Clipboard.setStringAsync(address);
    setCopiedAddress(address);
    setTimeout(() => {
      setCopiedAddress((current) => (current === address ? null : current));
    }, 1500);
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-3 px-4 pt-3 pb-safe-offset-5"
    >
      <View className="gap-2.5 rounded-2xl bg-muted px-3.5 py-3.5 border-continuous">
        <WalletHeading
          icon={<WalletCards size={20} color="currentColor" />}
          label="In-app wallet"
          detail="Pays x402 calls"
          status={inAppStatus}
        />
        {wallet.embeddedWalletAddress ? (
          <>
            <AddressRow
              address={wallet.embeddedWalletAddress}
              copied={copiedAddress === wallet.embeddedWalletAddress}
              onCopy={copyAddress}
            />
            <WalletBalanceDisplay
              key={wallet.embeddedWalletAddress}
              address={wallet.embeddedWalletAddress}
            />
          </>
        ) : (
          <Text selectable className="text-[14px] leading-5 text-muted-foreground">
            Create this wallet to make x402 calls.
          </Text>
        )}
        {wallet.getPaymentSigner ? (
          <View className="gap-2">
            <WalletActionButton action={{ label: isCalling ? "Calling…" : "Get BTC quote · 0.002 USDC", onPress: callEndpoint }} disabled={isCalling} />
            {result ? <Text selectable className="text-[13px] leading-5 text-foreground">{result}</Text> : null}
          </View>
        ) : null}
        {inAppAction ? (
          <WalletActionButton action={inAppAction} disabled={isWorking} />
        ) : null}
        {inAppError ? (
          <Text selectable className="text-[14px] leading-5 text-muted-foreground">
            {inAppError}
          </Text>
        ) : null}
      </View>

      <View className="gap-2.5 rounded-2xl border border-border px-3.5 py-3.5 border-continuous">
        <WalletHeading
          icon={<ShieldCheck size={20} color="currentColor" />}
          label="Sign-in wallet"
          detail="Authentication only"
          status={externalStatus}
        />
        {wallet.externalWalletAddress ? (
          <>
            <AddressRow
              address={wallet.externalWalletAddress}
              copied={copiedAddress === wallet.externalWalletAddress}
              onCopy={copyAddress}
            />
            <WalletBalanceDisplay
              key={wallet.externalWalletAddress}
              address={wallet.externalWalletAddress}
            />
          </>
        ) : null}
        {externalAction ? (
          <WalletActionButton action={externalAction} disabled={isWorking} />
        ) : null}
        {externalError ? (
          <Text selectable className="text-[14px] leading-5 text-muted-foreground">
            {externalError}
          </Text>
        ) : null}
      </View>

      {statusMessage ? (
        <Text
          selectable
          className="px-1 text-[14px] leading-5 text-muted-foreground"
        >
          {statusMessage}
        </Text>
      ) : null}
    </ScrollView>
  );
}

function WalletHeading({
  detail,
  icon,
  label,
  status,
}: {
  detail: string;
  icon: ReactNode;
  label: string;
  status: string;
}) {
  return (
    <View className="flex-row items-center gap-2.5">
      {icon}
      <View className="flex-1 gap-0.5">
        <Text className="text-[16px] font-semibold text-foreground">{label}</Text>
        <Text className="text-[12px] text-muted-foreground">{detail}</Text>
      </View>
      <Text className="text-[12px] font-medium text-muted-foreground">
        {status}
      </Text>
    </View>
  );
}

function AddressRow({
  address,
  copied,
  onCopy,
}: {
  address: string;
  copied: boolean;
  onCopy: (address: string) => Promise<void>;
}) {
  return (
    <View className="flex-row items-center gap-2 rounded-lg bg-background px-2.5 py-1.5 border-continuous">
      <Text
        selectable
        numberOfLines={1}
        accessibilityLabel={`Wallet address ${address}`}
        className="flex-1 font-mono text-[13px] text-foreground"
      >
        {formatAddress(address)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          copied ? "Wallet address copied" : "Copy wallet address"
        }
        className="flex-row items-center gap-1.5 rounded-md px-2 py-1.5 active:bg-muted"
        onPress={() => {
          void onCopy(address);
        }}
      >
        {copied ? (
          <Check size={15} color="currentColor" />
        ) : (
          <Copy size={15} color="currentColor" />
        )}
        <Text
          accessibilityLiveRegion="polite"
          className="text-[13px] font-semibold text-foreground"
        >
          {copied ? "Copied" : "Copy"}
        </Text>
      </Pressable>
    </View>
  );
}
