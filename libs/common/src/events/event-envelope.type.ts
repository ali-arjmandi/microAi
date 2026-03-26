export interface EventEnvelope<TPayload> {
  eventId: string;
  eventType: string;
  occurredAt: string;
  payload: TPayload;
}
