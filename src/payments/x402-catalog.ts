import { z } from "zod";

const X402HttpMethodSchema = z.enum(["GET", "POST"]);

export const X402EndpointContractSchema = z.object({
  method: X402HttpMethodSchema,
  required: z.array(z.string()),
  properties: z.record(z.string(), z.object({
    description: z.string(),
    enum: z.array(z.string()).optional(),
  })),
  mutuallyExclusive: z.array(z.array(z.string())).default([]),
});

export type X402EndpointContract = z.infer<typeof X402EndpointContractSchema>;

type CatalogEntry = {
  resourceUrl: string;
  contract: X402EndpointContract;
  bodySchema: z.ZodType<Record<string, unknown>>;
};

const nansenTimeframe = z.enum(["5m", "10m", "1h", "6h", "12h", "24h", "1d", "7d", "30d"]);

const catalog: CatalogEntry[] = [
  {
    resourceUrl: "https://api.nansen.ai/api/v1/token-screener",
    contract: {
      method: "POST",
      required: ["chains", "timeframe or date"],
      properties: {
        chains: { description: "One or more chains to screen." },
        timeframe: { description: "Relative lookback. Do not send with date.", enum: nansenTimeframe.options },
        date: { description: "Absolute date range. Do not send with timeframe." },
      },
      mutuallyExclusive: [["timeframe", "date"]],
    },
    bodySchema: z.object({
      chains: z.array(z.string().min(1)).min(1),
      timeframe: nansenTimeframe.optional(),
      date: z.object({ from: z.string().min(1), to: z.string().min(1) }).optional(),
    }).passthrough().superRefine((body, context) => {
      if (body.timeframe !== undefined && body.date !== undefined) {
        context.addIssue({ code: "custom", message: "timeframe and date cannot be used together.", path: ["date"] });
      }
      if (body.timeframe === undefined && body.date === undefined) {
        context.addIssue({ code: "custom", message: "Provide either timeframe or date.", path: ["timeframe"] });
      }
    }),
  },
  {
    resourceUrl: "https://api.nansen.ai/api/v1/tgm/flow-intelligence",
    contract: {
      method: "POST",
      required: ["chain", "token_address"],
      properties: {
        chain: { description: "Chain containing the token." },
        token_address: { description: "Token contract or mint address." },
        timeframe: { description: "Relative lookback.", enum: ["5m", "1h", "6h", "12h", "1d", "7d"] },
      },
      mutuallyExclusive: [],
    },
    bodySchema: z.object({
      chain: z.string().min(1),
      token_address: z.string().min(1),
      timeframe: z.enum(["5m", "1h", "6h", "12h", "1d", "7d"]).optional(),
    }).passthrough(),
  },
];

export function getX402EndpointContract(resourceUrl: string) {
  return catalog.find((entry) => entry.resourceUrl === resourceUrl)?.contract ?? null;
}

export function isValidCatalogRequest(input: {
  resourceUrl: string;
  method: "GET" | "POST";
  body?: Record<string, unknown>;
}) {
  const entry = catalog.find((candidate) => candidate.resourceUrl === input.resourceUrl);
  if (!entry) return true;
  if (input.method !== entry.contract.method || input.body === undefined) return false;
  return entry.bodySchema.safeParse(input.body).success;
}
