export const AMBIGUOUS_PAYMENT_ERROR_NAME = "AmbiguousPaymentError";

export class AmbiguousPaymentError extends Error {
  override name = AMBIGUOUS_PAYMENT_ERROR_NAME;
}

export function isAmbiguousPaymentError(error: unknown) {
  return error instanceof Error && error.name === AMBIGUOUS_PAYMENT_ERROR_NAME;
}
