export const CHAT_AGENT_CLASS = "ChatAgent";
export const CHAT_AGENT_MODEL = "@cf/zai-org/glm-4.7-flash";
export const HEALTH_PATH = "/health";

export const DEVELOPMENT_ENVIRONMENT = "development";

export function isDevelopmentEnvironment(environment: string) {
  return environment === DEVELOPMENT_ENVIRONMENT;
}
