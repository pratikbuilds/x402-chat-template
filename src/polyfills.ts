import "fast-text-encoding";
import "react-native-get-random-values";
import "@ethersproject/shims";
import "event-target-polyfill";

export function getSecureRandomnessError() {
  const randomValues = globalThis.crypto?.getRandomValues;

  if (typeof randomValues !== "function") {
    return "Secure randomness is unavailable on this device.";
  }

  try {
    const bytes = new Uint8Array(1);
    randomValues.call(globalThis.crypto, bytes);
    return null;
  } catch {
    return "Secure randomness is unavailable on this device.";
  }
}
