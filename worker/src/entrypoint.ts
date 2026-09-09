import { HEALTH_PATH, isDevelopmentEnvironment } from "./contracts";

type DevelopmentEnvironment = {
  DEPLOYMENT_ENVIRONMENT: string;
};

type AgentRequestRouter<TEnvironment extends DevelopmentEnvironment> = (
  request: Request,
  environment: TEnvironment,
) => Promise<Response | null | undefined> | Response | null | undefined;

function isWebSocketUpgrade(request: Request) {
  return request.headers.get("Upgrade")?.toLowerCase() === "websocket";
}

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function withCors(response: Response, request: Request) {
  if (response.status === 101 || response.webSocket || isWebSocketUpgrade(request)) {
    return response;
  }

  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function handleRequest<TEnvironment extends DevelopmentEnvironment>(
  request: Request,
  environment: TEnvironment,
  routeAgentRequest: AgentRequestRouter<TEnvironment>,
) {
  if (!isDevelopmentEnvironment(environment.DEPLOYMENT_ENVIRONMENT)) {
    return new Response("Not found", { status: 404 });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request),
    });
  }

  const url = new URL(request.url);
  if (url.pathname === HEALTH_PATH) {
    return withCors(Response.json({ ok: true }), request);
  }

  const response =
    (await routeAgentRequest(request, environment)) ??
    new Response("Not found", { status: 404 });

  if (isWebSocketUpgrade(request)) {
    return response;
  }

  return withCors(response, request);
}
