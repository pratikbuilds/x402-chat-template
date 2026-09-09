const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = withUniwindConfig(getDefaultConfig(__dirname), {
  cssEntryFile: "./src/global.css",
  debug: true,
});

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === "web" &&
    ["@expo/ui/swift-ui", "@expo/ui/swift-ui/modifiers"].includes(moduleName)
  ) {
    return {
      type: "empty",
    };
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
