import { EventEnvelope } from '@app/common';
import { Injectable, Logger } from '@nestjs/common';
import { IndexingService } from './elasticsearch.indexing.service';

interface TransactionUpsertPayload {
  transactionId?: string;
  title?: string;
  propertyAddress?: string;
  price?: number;
  buyerId?: string;
  sellerId?: string;
  state?: string;
}

interface TransactionDeletePayload {
  transactionId?: string;
}

interface AiEnrichedPayload {
  transactionId?: string;
  summary?: string;
  improvedDescription?: string;
  riskNarrative?: string;
  tags?: string[];
}

interface AiRejectedPayload {
  transactionId?: string;
  reason?: string;
}

@Injectable()
export class ElasticsearchConsumer {
  private readonly logger = new Logger(ElasticsearchConsumer.name);
  private readonly processedEventIds = new Set<string>();
  private readonly processedEventQueue: string[] = [];
  private readonly maxTrackedEventIds = 10_000;

  constructor(private readonly indexingService: IndexingService) {}

  handleMessage(payload: unknown): void {
    let envelope: EventEnvelope<unknown>;

    try {
      envelope = this.getEnvelope(payload);
    } catch (error) {
      this.logger.warn(
        `Skipping malformed message: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    if (this.isDuplicateEvent(envelope.eventId)) {
      this.logger.debug(
        `Skipping duplicate eventId="${envelope.eventId}" eventType="${envelope.eventType}"`,
      );
      return;
    }

    const normalizedEventType = this.normalizeEventType(envelope.eventType);

    switch (normalizedEventType) {
      case 'transaction.created':
      case 'transaction.updated':
        this.handleTransactionUpsert(envelope);
        return;
      case 'transaction.deleted':
        this.handleTransactionDelete(envelope);
        return;
      case 'ai.enriched':
        this.handleAiEnriched(envelope);
        return;
      case 'ai.rejected':
        this.handleAiRejected(envelope);
        return;
      default:
        this.logger.warn(
          `Ignoring unsupported eventType="${envelope.eventType}" eventId="${envelope.eventId}"`,
        );
    }
  }

  private getEnvelope(payload: unknown): EventEnvelope<unknown> {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Message payload must be an event envelope object');
    }

    const maybeEnvelope = payload as Partial<EventEnvelope<unknown>>;
    if (
      typeof maybeEnvelope.eventId !== 'string' ||
      typeof maybeEnvelope.eventType !== 'string'
    ) {
      throw new Error(
        'Message envelope is missing required fields: eventId/eventType',
      );
    }

    return maybeEnvelope as EventEnvelope<unknown>;
  }

  private isDuplicateEvent(eventId: string): boolean {
    if (this.processedEventIds.has(eventId)) {
      return true;
    }

    this.processedEventIds.add(eventId);
    this.processedEventQueue.push(eventId);

    if (this.processedEventQueue.length > this.maxTrackedEventIds) {
      const evictedId = this.processedEventQueue.shift();
      if (evictedId) {
        this.processedEventIds.delete(evictedId);
      }
    }

    return false;
  }

  private normalizeEventType(eventType: string): string {
    return eventType.trim().replace(/\.v\d+$/u, '');
  }

  private handleTransactionUpsert(envelope: EventEnvelope<unknown>): void {
    const payload = this.getRecordPayload(envelope.payload);
    if (typeof payload.transactionId !== 'string') {
      this.logger.warn(
        `Skipping event with missing transactionId eventId="${envelope.eventId}" eventType="${envelope.eventType}"`,
      );
      return;
    }

    const transactionPayload = payload as unknown as TransactionUpsertPayload;
    this.indexingService.upsertDocument({
      transactionId: transactionPayload.transactionId,
      title: transactionPayload.title,
      propertyAddress: transactionPayload.propertyAddress,
      price: transactionPayload.price,
      buyerId: transactionPayload.buyerId,
      sellerId: transactionPayload.sellerId,
      state: transactionPayload.state,
      eventType: envelope.eventType,
      eventId: envelope.eventId,
      occurredAt: envelope.occurredAt,
    });
  }

  private handleTransactionDelete(envelope: EventEnvelope<unknown>): void {
    const payload = this.getRecordPayload(
      envelope.payload,
    ) as unknown as TransactionDeletePayload;
    if (!payload.transactionId) {
      this.logger.warn(
        `Skipping delete event with missing transactionId eventId="${envelope.eventId}"`,
      );
      return;
    }

    this.indexingService.deleteDocument(payload.transactionId);
  }

  private handleAiEnriched(envelope: EventEnvelope<unknown>): void {
    const payload = this.getRecordPayload(
      envelope.payload,
    ) as unknown as AiEnrichedPayload;
    if (!payload.transactionId) {
      this.logger.warn(
        `Skipping AI enriched event with missing transactionId eventId="${envelope.eventId}"`,
      );
      return;
    }

    this.indexingService.upsertDocument({
      transactionId: payload.transactionId,
      summary: payload.summary,
      improvedDescription: payload.improvedDescription,
      riskNarrative: payload.riskNarrative,
      tags: Array.isArray(payload.tags)
        ? payload.tags.filter((tag) => typeof tag === 'string')
        : undefined,
      aiStatus: 'COMPLETED',
      moderationStatus: 'ALLOW',
      eventType: envelope.eventType,
      eventId: envelope.eventId,
      occurredAt: envelope.occurredAt,
    });
  }

  private handleAiRejected(envelope: EventEnvelope<unknown>): void {
    const payload = this.getRecordPayload(
      envelope.payload,
    ) as unknown as AiRejectedPayload;
    if (!payload.transactionId) {
      this.logger.warn(
        `Skipping AI rejected event with missing transactionId eventId="${envelope.eventId}"`,
      );
      return;
    }

    this.indexingService.upsertDocument({
      transactionId: payload.transactionId,
      moderationStatus: 'REJECT',
      moderationReason: payload.reason,
      aiStatus: 'FAILED',
      searchStatus: 'FAILED',
      eventType: envelope.eventType,
      eventId: envelope.eventId,
      occurredAt: envelope.occurredAt,
    });
  }

  private getRecordPayload(payload: unknown): Record<string, unknown> {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Event payload must be an object');
    }
    return payload as Record<string, unknown>;
  }
}
