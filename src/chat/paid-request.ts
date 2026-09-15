import { parseX402PaymentRequest } from "../payments/x402-request";

export const BTC_QUOTE_URL = "https://mcp.blocksize.info/v1/bidask/BTC-USD";

export function getPaidRequest(text: string) {
  const url = text.trim().match(/^call\s+(https:\/\/[^\s<>]+)$/i)?.[1];
  if (url) {
    return parseX402PaymentRequest({ resourceUrl: url, reason: "Fetch the requested paid resource" });
  }
  if (/^get (?:the current paid BTC-USD bid and ask|a paid BTC-USD bid\/ask snapshot)\.?$/i.test(text.trim())) {
    return { resourceUrl: BTC_QUOTE_URL, reason: "Get the current paid BTC-USD bid and ask" };
  }
  return null;
}
