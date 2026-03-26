export interface OutboxEventEntity {
  readonly id: string;
  readonly topic: string;
  readonly payload: Record<string, unknown>;
}
