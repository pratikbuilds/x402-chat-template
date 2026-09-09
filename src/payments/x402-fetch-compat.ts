export async function attachPaymentRequiredHeader(response: Response) {
  if (
    response.headers.get("payment-required") ||
    response.headers.get("PAYMENT-REQUIRED")
  ) {
    return response;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return response;
  }

  const body: unknown = await response.clone().json().catch(() => null);
  if (
    typeof body !== "object" ||
    body === null ||
    !("x402Version" in body) ||
    !("accepts" in body) ||
    !Array.isArray((body as { accepts: unknown }).accepts)
  ) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("PAYMENT-REQUIRED", encodeJsonAsBase64(body));

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function encodeJsonAsBase64(value: unknown) {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  return globalThis.btoa(String.fromCharCode(...bytes));
}
