import { afterAll, expect, test } from "bun:test";

import { getPayCatalogOperation, searchPayCatalog, validateCatalogPayment } from "./pay-catalog";

const originalFetch = globalThis.fetch;

globalThis.fetch = async (input) => {
  const url = String(input);
  if (url === "https://catalog.pay.sh/v1/skills.json") {
    return Response.json({
      base_url: "https://catalog.example",
      providers: [{
        fqn: "example/widgets",
        title: "Widgets",
        description: "Create catalog-backed widgets.",
        use_case: "Use for creating widgets.",
        category: "data",
        service_url: "https://widgets.example",
        min_price_usd: 0.01,
        max_price_usd: 0.01,
        sha: "fixture-v1",
      }],
    });
  }
  if (url === "https://catalog.example/providers/example/widgets.json") {
    return Response.json({
      fqn: "example/widgets",
      endpoints: [{ method: "POST", path: "v1/widgets", description: "Create a widget" }],
      openapi_doc: {
        openapi: "3.1.0",
        paths: {
          "/v1/widgets": {
            post: {
              requestBody: {
                required: true,
                content: { "application/json": { schema: { $ref: "#/components/schemas/CreateWidget" } } },
              },
            },
          },
        },
        components: {
          schemas: {
            CreateWidget: {
              type: "object",
              additionalProperties: false,
              required: ["name", "kind"],
              properties: {
                name: { type: "string", examples: ["daily-brief"] },
                kind: { type: "string", enum: ["brief", "report"] },
              },
            },
          },
        },
      },
    });
  }
  return new Response(null, { status: 404 });
};

afterAll(() => {
  globalThis.fetch = originalFetch;
});

test("resolves a catalog operation and its OpenAPI body contract", async () => {
  const operation = await getPayCatalogOperation({
    providerFqn: "example/widgets",
    resourceUrl: "https://widgets.example/v1/widgets",
  });

  expect(operation).toMatchObject({
    providerFqn: "example/widgets",
    method: "POST",
    resourceUrl: "https://widgets.example/v1/widgets",
  });
  expect(operation.bodyExample).toEqual({ name: "daily-brief", kind: "brief" });
  expect(operation.bodySchema).toMatchObject({
    required: ["name", "kind"],
    properties: { kind: { enum: ["brief", "report"] } },
  });
  expect(JSON.stringify(operation.bodySchema)).not.toContain("components");
});

test("discovers catalog operations without a provider-specific rule", async () => {
  const results = await searchPayCatalog("create a widget brief");
  expect(results[0]).toMatchObject({
    provider: { fqn: "example/widgets" },
    operations: [{ resourceUrl: "https://widgets.example/v1/widgets", method: "POST" }],
  });
});

test("rejects an invalid catalog body before payment", async () => {
  await expect(validateCatalogPayment({
    providerFqn: "example/widgets",
    resourceUrl: "https://widgets.example/v1/widgets",
    method: "POST",
    body: { name: "daily-brief", kind: "invalid" },
  })).rejects.toThrow("Pay catalog validation failed before sending");
});

test("rejects a missing required body before payment", async () => {
  await expect(validateCatalogPayment({
    providerFqn: "example/widgets",
    resourceUrl: "https://widgets.example/v1/widgets",
    method: "POST",
  })).rejects.toThrow("Pay catalog validation failed before sending");
});

test("accepts a valid body from the catalog OpenAPI schema", async () => {
  await expect(validateCatalogPayment({
    providerFqn: "example/widgets",
    resourceUrl: "https://widgets.example/v1/widgets",
    method: "POST",
    body: { name: "daily-brief", kind: "brief" },
  })).resolves.toMatchObject({ providerFqn: "example/widgets" });
});
