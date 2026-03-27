export function isIncomingEventApplicable(
  incomingOccurredAt: string,
  lastAppliedOccurredAt: string | undefined,
): boolean {
  const trimmedLast = lastAppliedOccurredAt?.trim();
  if (!trimmedLast) {
    return true;
  }
  const incomingMs = Date.parse(incomingOccurredAt);
  const lastMs = Date.parse(trimmedLast);
  if (Number.isNaN(incomingMs) || Number.isNaN(lastMs)) {
    return true;
  }
  return incomingMs >= lastMs;
}
