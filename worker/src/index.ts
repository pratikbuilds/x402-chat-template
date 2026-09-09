import { routeAgentRequest } from "agents";

import { ChatAgent } from "./chat-agent";
import { handleRequest } from "./entrypoint";

export { ChatAgent };

export default {
  async fetch(request, env) {
    return handleRequest(request, env, routeAgentRequest);
  },
} satisfies ExportedHandler<Env>;
