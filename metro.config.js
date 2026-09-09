const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");
const path = require("path");

/** @type {import('expo/metro-config').MetroConfig} */
const config = withUniwindConfig(getDefaultConfig(__dirname), {
  cssEntryFile: "./src/global.css",
  debug: true,
});

const defaultResolveRequest = config.resolver.resolveRequest;
const nodeCryptoShim = path.resolve(__dirname, "src/shims/node-crypto.js");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === "web" &&
    ["@expo/ui/swift-ui", "@expo/ui/swift-ui/modifiers"].includes(moduleName)
  ) {
    return {
      type: "empty",
    };
  }

  if (moduleName === "crypto") {
    const origin = context.originModulePath ?? "";
    if (
      origin.includes("@solana/pay-kit") ||
      origin.includes("@solana+pay-kit") ||
      origin.includes("@x402/") ||
      origin.includes("@x402+") ||
      origin.includes("x402-svm")
    ) {
      // pay-kit's bundled @x402/svm imports Node createHash from "crypto".
      return {
        filePath: nodeCryptoShim,
        type: "sourceFile",
      };
    }
  }

  if (moduleName === "jose") {
    const browserContext = {
      ...context,
      unstable_conditionNames: ["browser"],
    };
    return defaultResolveRequest
      ? defaultResolveRequest(browserContext, moduleName, platform)
      : browserContext.resolveRequest(browserContext, moduleName, platform);
  }

  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
