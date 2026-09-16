import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { getWalletBalances } from "./wallet-balances";

type Snapshot = {
  balances: Awaited<ReturnType<typeof getWalletBalances>> | null;
  refreshing: boolean;
  error: boolean;
};
function createEntry() {
  const snapshot: Snapshot = { balances: null, refreshing: false, error: false };
  return { snapshot, listeners: new Set<() => void>(), request: 0 };
}
const entries = new Map<string, ReturnType<typeof createEntry>>();
function entryFor(address: string) {
  let entry = entries.get(address);
  if (!entry) {
    entry = createEntry();
    entries.set(address, entry);
  }
  return entry;
}
export async function refreshWalletBalance(address: string) {
  const entry = entryFor(address);
  const request = ++entry.request;
  const update = (snapshot: Snapshot) => {
    if (entry.request !== request) return;
    entry.snapshot = snapshot;
    entry.listeners.forEach((listener) => listener());
  };
  update({ ...entry.snapshot, refreshing: true, error: false });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const balances = await getWalletBalances(address, controller.signal);
    update({ balances, refreshing: false, error: false });
  } catch {
    update({ ...entry.snapshot, refreshing: false, error: true });
  } finally {
    clearTimeout(timeout);
  }
}
export function refreshBalanceAfterPayment(address: string) {
  void refreshWalletBalance(address);
  // A provider receipt can arrive before the confirmed RPC balance catches up.
  setTimeout(() => void refreshWalletBalance(address), 3000);
  setTimeout(() => void refreshWalletBalance(address), 8000);
}
export function useWalletBalance(address: string) {
  const entry = entryFor(address);
  const snapshot = useSyncExternalStore(
    (listener) => { entry.listeners.add(listener); return () => { entry.listeners.delete(listener); }; },
    () => entry.snapshot,
    () => entry.snapshot,
  );
  useEffect(() => {
    if (!entry.snapshot.refreshing) void refreshWalletBalance(address);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshWalletBalance(address);
    });
    return () => subscription.remove();
  }, [address, entry]);
  return snapshot;
}
