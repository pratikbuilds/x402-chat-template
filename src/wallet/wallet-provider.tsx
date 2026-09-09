import {
  hasError,
  isConnected,
  isCreating,
  isNotCreated,
  PrivyProvider,
  useEmbeddedSolanaWallet,
  useLoginWithSiws,
  usePrivy,
} from "@privy-io/expo";
import {
  createSolanaDevnet,
  fromUint8Array,
  MobileWalletProvider,
  useMobileWallet,
  type AppIdentity,
} from "@wallet-ui/react-native-kit";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  isPrivySolanaSignProvider,
  type PrivySolanaSignProvider,
} from "@/payments/privy-kit-signer";
import { getSecureRandomnessError } from "@/polyfills";

const MWA_IDENTITY = {
  name: "Chat",
  uri: "x402-chat://wallet",
} satisfies AppIdentity;

const SOLANA_DEVNET = createSolanaDevnet();

type WalletAction = "connect" | "sign-in" | "create" | "disconnect";

export type WalletState =
  | { kind: "unavailable"; message: string }
  | { kind: "loading" }
  | { kind: "external-wallet-disconnected" }
  | { kind: "ready-to-sign-in" }
  | { kind: "ready-to-create" }
  | { kind: "working"; action: WalletAction }
  | { kind: "error"; action: WalletAction; message: string }
  | { kind: "ready" };

export function getWalletStatusText(state: WalletState) {
  switch (state.kind) {
    case "unavailable":
      return state.message;
    case "loading":
      return "Preparing wallet services…";
    case "external-wallet-disconnected":
      return "Connect a Solana wallet to sign in.";
    case "ready-to-sign-in":
      return "Approve the Sign-In With Solana message in your wallet.";
    case "ready-to-create":
      return "Your in-app wallet is ready to create.";
    case "working":
      return "Working…";
    case "error":
      return state.message;
    case "ready":
      return "Your wallet is ready. Payments will always need approval.";
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

type WalletContextValue = Readonly<{
  embeddedWalletAddress: string | null;
  externalWalletAddress: string | null;
  getEmbeddedSolanaProvider: (() => Promise<PrivySolanaSignProvider>) | null;
  state: WalletState;
  connectExternalWallet: () => Promise<void>;
  createEmbeddedWallet: () => Promise<void>;
  disconnectWallets: () => Promise<void>;
  signInWithSolana: () => Promise<void>;
}>;

const doNothing = async () => {};

const unavailableWalletValue = (message: string) =>
  ({
    embeddedWalletAddress: null,
    externalWalletAddress: null,
    getEmbeddedSolanaProvider: null,
    state: { kind: "unavailable", message },
    connectExternalWallet: doNothing,
    createEmbeddedWallet: doNothing,
    disconnectWallets: doNothing,
    signInWithSolana: doNothing,
  }) satisfies WalletContextValue;

const WalletContext = createContext<WalletContextValue | null>(null);

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Wallet setup failed.";
}

function WalletConnectionProvider({ children }: { children: ReactNode }) {
  const { account, connect, disconnect, signMessages } = useMobileWallet();
  const { error: privyError, isReady, logout, user } = usePrivy();
  const { generateMessage, login } = useLoginWithSiws();
  const embeddedSolanaWallet = useEmbeddedSolanaWallet();
  const [pendingAction, setPendingAction] = useState<WalletAction | null>(null);
  const [lastError, setLastError] = useState<{
    action: WalletAction;
    message: string;
  } | null>(null);

  const externalWalletAddress = account?.address.toString() ?? null;
  const embeddedWallet = isConnected(embeddedSolanaWallet)
    ? embeddedSolanaWallet.wallets[0]
    : null;
  const embeddedWalletAddress = embeddedWallet?.address ?? null;

  const runAction = useCallback(
    async (action: WalletAction, operation: () => Promise<void>) => {
      setLastError(null);
      setPendingAction(action);

      try {
        await operation();
      } catch (error) {
        setLastError({ action, message: toErrorMessage(error) });
      } finally {
        setPendingAction(null);
      }
    },
    [],
  );

  const connectExternalWallet = useCallback(
    async () =>
      runAction("connect", async () => {
        await connect();
      }),
    [connect, runAction],
  );

  const signInWithSolana = useCallback(async () => {
    await runAction("sign-in", async () => {
      if (!account) {
        throw new Error("Connect a Solana wallet before signing in.");
      }

      const { message } = await generateMessage({
        from: { domain: "x402-chat", uri: "x402-chat://privy-login" },
        wallet: { address: account.address.toString() },
      });
      const signature = fromUint8Array(
        await signMessages(new TextEncoder().encode(message)),
      );

      await login({ message, signature });
    });
  }, [account, generateMessage, login, runAction, signMessages]);

  const createEmbeddedWallet = useCallback(async () => {
    await runAction("create", async () => {
      if (isNotCreated(embeddedSolanaWallet)) {
        await embeddedSolanaWallet.create();
      }
    });
  }, [embeddedSolanaWallet, runAction]);

  const disconnectWallets = useCallback(
    async () =>
      runAction("disconnect", async () => {
        await logout();
        await disconnect();
      }),
    [disconnect, logout, runAction],
  );

  const state = useMemo<WalletState>(() => {
    if (lastError) {
      return { kind: "error", ...lastError };
    }
    if (privyError) {
      return { kind: "unavailable", message: privyError.message };
    }
    if (!isReady) {
      return { kind: "loading" };
    }
    if (pendingAction) {
      return { kind: "working", action: pendingAction };
    }
    if (!account) {
      return { kind: "external-wallet-disconnected" };
    }
    if (!user) {
      return { kind: "ready-to-sign-in" };
    }
    if (isCreating(embeddedSolanaWallet)) {
      return { kind: "working", action: "create" };
    }
    if (embeddedWallet) {
      return { kind: "ready" };
    }
    if (isNotCreated(embeddedSolanaWallet)) {
      return { kind: "ready-to-create" };
    }
    if (hasError(embeddedSolanaWallet)) {
      return { kind: "unavailable", message: embeddedSolanaWallet.error };
    }
    return { kind: "loading" };
  }, [
    account,
    embeddedSolanaWallet,
    embeddedWallet,
    isReady,
    lastError,
    pendingAction,
    privyError,
    user,
  ]);

  const getEmbeddedSolanaProvider = useMemo(() => {
    if (state.kind !== "ready" || !embeddedWallet) {
      return null;
    }

    const wallet = embeddedWallet;
    return async () => {
      const provider = await wallet.getProvider();
      if (!isPrivySolanaSignProvider(provider)) {
        throw new Error("The in-app wallet is not ready to pay.");
      }
      return provider;
    };
  }, [embeddedWallet, state.kind]);

  const value = useMemo<WalletContextValue>(
    () => ({
      embeddedWalletAddress,
      externalWalletAddress,
      getEmbeddedSolanaProvider,
      state,
      connectExternalWallet,
      createEmbeddedWallet,
      disconnectWallets,
      signInWithSolana,
    }),
    [
      connectExternalWallet,
      createEmbeddedWallet,
      disconnectWallets,
      embeddedWalletAddress,
      externalWalletAddress,
      getEmbeddedSolanaProvider,
      signInWithSolana,
      state,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const appId = process.env.EXPO_PUBLIC_PRIVY_APP_ID;
  const clientId = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID;
  const secureRandomnessError = getSecureRandomnessError();

  if (secureRandomnessError) {
    return (
      <WalletContext.Provider value={unavailableWalletValue(secureRandomnessError)}>
        {children}
      </WalletContext.Provider>
    );
  }

  if (!appId || !clientId) {
    return (
      <WalletContext.Provider
        value={unavailableWalletValue("Privy is not configured for this build.")}
      >
        {children}
      </WalletContext.Provider>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId}
      config={{ embedded: { solana: { createOnLogin: "all-users" } } }}
    >
      <MobileWalletProvider cluster={SOLANA_DEVNET} identity={MWA_IDENTITY}>
        <WalletConnectionProvider>{children}</WalletConnectionProvider>
      </MobileWalletProvider>
    </PrivyProvider>
  );
}

export function useWallet() {
  const value = useOptionalWallet();

  if (!value) {
    throw new Error("useWallet must be used within WalletProvider.");
  }

  return value;
}

export function useOptionalWallet() {
  return useContext(WalletContext);
}
