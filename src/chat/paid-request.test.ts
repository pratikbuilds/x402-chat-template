import { expect, test } from "bun:test";
import { BTC_QUOTE_URL, getPaidRequest } from "./paid-request";

test("routes explicit paid calls directly while leaving ordinary chat alone", () => {
  expect(getPaidRequest("Call https://example.com/paid?q=btc" )?.resourceUrl).toBe("https://example.com/paid?q=btc");
  expect(getPaidRequest("Get the current paid BTC-USD bid and ask.")?.resourceUrl).toBe(BTC_QUOTE_URL);
  expect(getPaidRequest("Do not call https://example.com")).toBeNull();
  expect(getPaidRequest("Explain how to call https://example.com")).toBeNull();
  expect(getPaidRequest("Call https://example.com but do not pay")).toBeNull();
  expect(getPaidRequest("Explain my paid BTC quote")).toBeNull();
  expect(getPaidRequest("Explain x402")).toBeNull();
  expect(getPaidRequest("Summarize https://example.com")).toBeNull();
  expect(getPaidRequest("Call http://example.com")).toBeNull();
});
