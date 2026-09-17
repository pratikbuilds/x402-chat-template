import { Validator, type Schema } from "@cfworker/json-schema";
import { z } from "zod";

const CATALOG_URL = "https://catalog.pay.sh/v1/skills.json";
const CACHE_MS = 30 * 60 * 1000;
const HttpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);
export const FqnSchema = z.string().regex(/^[a-z0-9-]+(?:\/[a-z0-9-]+)+$/);
const OpenapiDocumentSchema = z.custom<Schema>((value) => typeof value === "object" && value !== null);

const ProviderSchema = z.object({
  fqn: FqnSchema,
  title: z.string(),
  description: z.string(),
  use_case: z.string().optional(),
  category: z.string(),
  service_url: z.url(),
  min_price_usd: z.number(),
  max_price_usd: z.number(),
  sha: z.string(),
});

const CatalogSchema = z.object({
  base_url: z.url(),
  providers: z.array(ProviderSchema),
});

const EndpointSchema = z.object({
  method: HttpMethodSchema,
  path: z.string(),
  description: z.string(),
  pricing: z.unknown().optional(),
});

const ProviderDetailSchema = z.object({
  fqn: FqnSchema,
  endpoints: z.array(EndpointSchema),
  openapi_doc: OpenapiDocumentSchema,
});

type Catalog = z.infer<typeof CatalogSchema>;
type Provider = z.infer<typeof ProviderSchema>;
type ProviderDetail = z.infer<typeof ProviderDetailSchema>;

export type CatalogOperation = {
  providerFqn: string;
  resourceUrl: string;
  method: z.infer<typeof HttpMethodSchema>;
  description: string;
  pricing?: unknown;
  // A compact projection of the provider's OpenAPI request schema. The full
  // document remains local for validation and never enters the model context.
  bodySchema: unknown | null;
  bodyExample: unknown;
};

export const X402CatalogPaymentSchema = z.object({
  providerFqn: FqnSchema,
  resourceUrl: z.url().refine((value) => new URL(value).protocol === "https:"),
  method: HttpMethodSchema,
  body: z.record(z.string(), z.unknown()).optional(),
});

type CacheEntry<T> = { value: T; expiresAt: number };
let catalogCache: CacheEntry<Catalog> | null = null;
const detailCache = new Map<string, CacheEntry<ProviderDetail>>();

export async function searchPayCatalog(query: string) {
  const catalog = await loadCatalog();
  const normalized = query.toLowerCase();
  const direct = catalog.providers.filter((provider) => normalized.includes(provider.service_url.toLowerCase()));
  const providers = (direct.length > 0 ? direct : [...catalog.providers]
    .sort((left, right) => scoreProvider(right, normalized) - scoreProvider(left, normalized))
    .slice(0, 5));

  return Promise.all(providers.map(async (provider) => {
    const detail = await loadProviderDetail(catalog, provider);
    return {
      provider,
      operations: detail.endpoints
        .map((endpoint) => toOperation(provider, detail, endpoint))
        .sort((left, right) => scoreOperation(right, normalized) - scoreOperation(left, normalized))
        .slice(0, 5),
    };
  }));
}

export async function getPayCatalogOperation(input: {
  providerFqn: string;
  resourceUrl: string;
  method?: string;
}) {
  return (await resolveCatalogOperation(input)).operation;
}

export async function validateCatalogPayment(input: z.infer<typeof X402CatalogPaymentSchema>) {
  const resolved = await resolveCatalogOperation(input);
  const { operation } = resolved;
  if (resolved.validationSchema === null) {
    if (input.body !== undefined) throw validationError(operation, ["This operation does not accept a JSON body."]);
    return operation;
  }

  if (input.body === undefined) {
    if (resolved.bodyRequired) throw validationError(operation, ["This operation requires a JSON body."]);
    return operation;
  }

  const validator = new Validator(resolved.validationSchema, "2020-12", false);
  const result = validator.validate(input.body);
  if (!result.valid) throw validationError(operation, result.errors.map((error) => error.error));
  return operation;
}

function validationError(operation: CatalogOperation, problems: string[]) {
  const example = operation.bodyExample === undefined ? "" : ` Expected JSON body: ${JSON.stringify(operation.bodyExample)}.`;
  return new Error(`Pay catalog validation failed before sending ${operation.method} ${operation.resourceUrl}: ${problems.join(" ")}.${example}`);
}

async function loadCatalog() {
  if (catalogCache !== null && catalogCache.expiresAt > Date.now()) return catalogCache.value;
  const response = await fetch(CATALOG_URL);
  if (!response.ok) throw new Error(`Pay catalog could not be loaded (${response.status}).`);
  const catalog = CatalogSchema.parse(await response.json());
  catalogCache = { value: catalog, expiresAt: Date.now() + CACHE_MS };
  return catalog;
}

async function loadProviderDetail(catalog: Catalog, provider: Provider) {
  const cacheKey = `${provider.fqn}:${provider.sha}`;
  const cached = detailCache.get(cacheKey);
  if (cached !== undefined && cached.expiresAt > Date.now()) return cached.value;
  const response = await fetch(`${catalog.base_url}/providers/${provider.fqn}.json`);
  if (!response.ok) throw new Error(`Pay catalog detail for ${provider.fqn} could not be loaded (${response.status}).`);
  const detail = ProviderDetailSchema.parse(await response.json());
  detailCache.set(cacheKey, { value: detail, expiresAt: Date.now() + CACHE_MS });
  return detail;
}

function toOperation(provider: Provider, detail: ProviderDetail, endpoint: z.infer<typeof EndpointSchema>): CatalogOperation {
  const resourceUrl = endpointUrl(provider, endpoint.path);
  const operation = readOperation(detail.openapi_doc, endpoint.path, endpoint.method);
  const bodySchema = operation === null ? null : readBodyContract(detail.openapi_doc, operation);
  return {
    providerFqn: provider.fqn,
    resourceUrl,
    method: endpoint.method,
    description: endpoint.description,
    pricing: endpoint.pricing,
    bodySchema,
    bodyExample: operation === null ? undefined : bodyExample(detail.openapi_doc, operation),
  };
}

function endpointUrl(provider: Provider, path: string) {
  return new URL(path.replace(/^\//, ""), `${provider.service_url.replace(/\/$/, "")}/`).toString();
}

function readOperation(document: Schema, path: string, method: string) {
  const paths = readRecord(document, "paths");
  const pathItem = paths?.[`/${path.replace(/^\//, "")}`] ?? paths?.[path];
  const methods = toRecord(pathItem);
  const operation = methods?.[method.toLowerCase()];
  return toRecord(operation) ?? null;
}

function readBodySchema(document: Schema, operation: Record<string, unknown>) {
  const requestBody = resolveRef(document, operation.requestBody);
  const content = readRecord(requestBody, "content");
  const media = content?.["application/json"] ?? Object.values(content ?? {})[0];
  const schema = toRecord(media)?.schema;
  const resolved = resolveRef(document, schema);
  return resolved === null ? null : { ...document, $ref: "#/$defs/body", $defs: { body: resolved } };
}

async function resolveCatalogOperation(input: {
  providerFqn: string;
  resourceUrl: string;
  method?: string;
}) {
  const catalog = await loadCatalog();
  const provider = catalog.providers.find((candidate) => candidate.fqn === input.providerFqn);
  if (!provider) throw new Error(`Pay catalog provider ${input.providerFqn} was not found.`);
  const detail = await loadProviderDetail(catalog, provider);
  const method = input.method === undefined ? undefined : HttpMethodSchema.safeParse(input.method.toUpperCase());
  if (method !== undefined && !method.success) throw new Error("The catalog method is invalid.");
  const endpoint = detail.endpoints.find((candidate) =>
    endpointUrl(provider, candidate.path) === input.resourceUrl
      && (method === undefined || candidate.method === method.data),
  );
  if (!endpoint) throw new Error("That URL and method are not a published Pay catalog operation.");
  const operation = toOperation(provider, detail, endpoint);
  const openapiOperation = readOperation(detail.openapi_doc, endpoint.path, endpoint.method);
  return {
    operation,
    validationSchema: openapiOperation === null ? null : readBodySchema(detail.openapi_doc, openapiOperation),
    bodyRequired: openapiOperation === null ? false : isBodyRequired(detail.openapi_doc, openapiOperation),
  };
}

function isBodyRequired(document: Schema, operation: Record<string, unknown>) {
  return resolveRef(document, operation.requestBody)?.required === true;
}

function readBodyContract(document: Schema, operation: Record<string, unknown>) {
  const requestBody = resolveRef(document, operation.requestBody);
  const content = readRecord(requestBody, "content");
  const media = content?.["application/json"] ?? Object.values(content ?? {})[0];
  return describeSchema(document, toRecord(media)?.schema);
}

function describeSchema(document: Schema, schema: unknown, depth = 0): unknown {
  if (depth > 8) return {};
  const resolved = resolveRef(document, schema);
  if (resolved === null) return null;
  const result: Record<string, unknown> = {};
  for (const key of ["type", "description", "format", "enum", "default", "example", "examples", "minimum", "maximum", "minLength", "maxLength", "pattern", "additionalProperties"]) {
    if (key in resolved) result[key] = resolved[key];
  }
  if (Array.isArray(resolved.required)) result.required = resolved.required;
  const properties = readRecord(resolved, "properties");
  if (properties !== undefined) {
    result.properties = Object.fromEntries(Object.entries(properties)
      .map(([key, value]) => [key, describeSchema(document, value, depth + 1)]));
  }
  if (resolved.items !== undefined) result.items = describeSchema(document, resolved.items, depth + 1);
  for (const key of ["oneOf", "anyOf", "allOf"] as const) {
    if (Array.isArray(resolved[key])) result[key] = resolved[key].map((value) => describeSchema(document, value, depth + 1));
  }
  return result;
}

function bodyExample(document: Schema, operation: Record<string, unknown>): unknown {
  const requestBody = resolveRef(document, operation.requestBody);
  const content = readRecord(requestBody, "content");
  const media = content?.["application/json"] ?? Object.values(content ?? {})[0];
  if (typeof media !== "object" || media === null) return undefined;
  const value = toRecord(media);
  if (value === undefined) return undefined;
  if ("example" in value) return value.example;
  const examples = readRecord(value, "examples");
  const first = examples === undefined ? undefined : Object.values(examples)[0];
  if (typeof first === "object" && first !== null && "value" in first) return first.value;
  return schemaExample(document, resolveRef(document, value.schema));
}

function schemaExample(document: Schema, schema: unknown): unknown {
  const resolved = resolveRef(document, schema);
  if (resolved === null) return undefined;
  if ("example" in resolved) return resolved.example;
  const examples = resolved.examples;
  if (Array.isArray(examples) && examples.length > 0) return examples[0];
  if ("default" in resolved) return resolved.default;
  if (Array.isArray(resolved.enum) && resolved.enum.length > 0) return resolved.enum[0];
  const properties = readRecord(resolved, "properties");
  const required = Array.isArray(resolved.required) ? resolved.required.filter((key): key is string => typeof key === "string") : [];
  if (properties !== undefined) return Object.fromEntries(required.map((key) => [key, schemaExample(document, properties[key])]));
  if (resolved.type === "array") return [schemaExample(document, resolved.items)];
  if (resolved.type === "string") return "string";
  if (resolved.type === "integer" || resolved.type === "number") return 0;
  if (resolved.type === "boolean") return false;
  return undefined;
}

function resolveRef(document: Schema, value: unknown): Record<string, unknown> | null {
  const record = toRecord(value);
  if (record === undefined) return null;
  const ref = record.$ref;
  if (typeof ref !== "string") return record;
  if (!ref.startsWith("#/")) return null;
  const resolved = ref.slice(2).split("/").reduce<unknown>((current, key) => toRecord(current)?.[key], document);
  return toRecord(resolved) ?? null;
}

function readRecord(value: unknown, key: string) {
  const record = toRecord(value);
  return record === undefined ? undefined : toRecord(record[key]);
}

function toRecord(value: unknown) {
  const result = z.record(z.string(), z.unknown()).safeParse(value);
  return result.success ? result.data : undefined;
}

function scoreProvider(provider: Provider, query: string) {
  return [provider.fqn, provider.title, provider.description, provider.use_case ?? ""]
    .reduce((score, field) => score + field.toLowerCase().split(/\W+/).filter((token) => token.length > 2 && query.includes(token)).length, 0);
}

function scoreOperation(operation: CatalogOperation, query: string) {
  return [operation.resourceUrl, operation.description]
    .reduce((score, field) => score + field.toLowerCase().split(/\W+/).filter((token) => token.length > 2 && query.includes(token)).length, 0);
}
