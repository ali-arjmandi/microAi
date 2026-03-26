export const mapTransactionEventToSearchDocument = (
  eventPayload: Record<string, unknown>,
): Record<string, unknown> => ({
  ...eventPayload,
});
