import {
  AiEnrichedEventV1,
  AiRejectedEventV1,
  EventEnvelope,
  TransactionCreatedEvent,
  TransactionUpdatedEvent,
} from '@app/common';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AiEventPublisher } from '../publishers/ai-event.publisher';

type TransactionPayload = TransactionCreatedEvent | TransactionUpdatedEvent;

@Injectable()
export class AiConsumer {
  private readonly logger = new Logger(AiConsumer.name);
  private readonly processedEventIds = new Set<string>();
  private readonly processedEventQueue: string[] = [];
  private readonly maxTrackedEventIds = 10_000;

  constructor(private readonly aiEventPublisher: AiEventPublisher) {}

  async handleMessage(payload: unknown): Promise<void> {
    const envelope = this.getEnvelope(payload);

    if (this.isDuplicateEvent(envelope.eventId)) {
      this.logger.debug(
        `Skipping duplicate eventId="${envelope.eventId}" eventType="${envelope.eventType}"`,
      );
      return;
    }

    const normalizedEventType = this.normalizeEventType(envelope.eventType);
    if (
      normalizedEventType !== 'transaction.created' &&
      normalizedEventType !== 'transaction.updated'
    ) {
      this.logger.warn(
        `Ignoring unsupported eventType="${envelope.eventType}" eventId="${envelope.eventId}"`,
      );
      return;
    }

    const transaction = this.getTransactionPayload(envelope.payload);
    if (!transaction.transactionId) {
      throw new Error(
        `Message payload is missing transactionId for eventType="${envelope.eventType}"`,
      );
    }

    const model = 'openrouter/free';
    const promptVersion = 'v1';
    const moderation = this.getModeration(transaction.description);

    if (moderation.status === 'REJECT') {
      const rejectedEnvelope: EventEnvelope<AiRejectedEventV1> = {
        eventId: randomUUID(),
        eventType: 'ai.rejected.v1',
        occurredAt: new Date().toISOString(),
        payload: {
          transactionId: transaction.transactionId,
          reason: moderation.reason,
          model,
          promptVersion,
        },
      };
      await this.aiEventPublisher.publishRejected(rejectedEnvelope);
      return;
    }

    const enrichedEnvelope: EventEnvelope<AiEnrichedEventV1> = {
      eventId: randomUUID(),
      eventType: 'ai.enriched.v1',
      occurredAt: new Date().toISOString(),
      payload: {
        transactionId: transaction.transactionId,
        summary: this.buildSummary(transaction),
        riskNarrative: this.buildRiskNarrative(transaction),
        searchTags: this.buildSearchTags(transaction),
        improvedDescription: this.buildImprovedDescription(transaction),
        moderation,
        model,
        promptVersion,
      },
    };

    await this.aiEventPublisher.publishEnriched(enrichedEnvelope);
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

  private getTransactionPayload(payload: unknown): TransactionPayload {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Event payload must be an object');
    }
    return payload as TransactionPayload;
  }

  private normalizeEventType(eventType: string): string {
    return eventType.trim().replace(/\.v\d+$/u, '');
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

  private getModeration(description?: string): AiEnrichedEventV1['moderation'] {
    const text = description?.toLowerCase() ?? '';
    if (text.includes('adult') || text.includes('explicit')) {
      return {
        status: 'REJECT',
        reason: 'policy_restricted_content',
        confidence: 0.95,
      };
    }

    return {
      status: 'ALLOW',
      reason: 'content_allowed',
      confidence: 0.9,
    };
  }

  private buildSummary(transaction: TransactionPayload): string {
    const title = transaction.title?.trim() || 'Untitled listing';
    const address = transaction.propertyAddress?.trim() || 'unknown location';
    return `${title} at ${address}`;
  }

  private buildRiskNarrative(transaction: TransactionPayload): string {
    if (
      typeof transaction.price === 'number' &&
      transaction.price > 1_000_000
    ) {
      return 'High-value transaction flagged for additional review.';
    }
    return 'No immediate risk indicators from baseline transaction attributes.';
  }

  private buildSearchTags(transaction: TransactionPayload): string[] {
    const tags = new Set<string>();
    if (transaction.state) {
      tags.add(transaction.state.toLowerCase());
    }
    if (typeof transaction.price === 'number') {
      tags.add(transaction.price > 1_000_000 ? 'high-value' : 'standard-value');
    }
    if (transaction.propertyAddress) {
      tags.add('has-address');
    }
    return Array.from(tags);
  }

  private buildImprovedDescription(transaction: TransactionPayload): string {
    const baseDescription = transaction.description?.trim();
    if (!baseDescription) {
      return 'Property listing details are pending additional information.';
    }
    return `${baseDescription} (AI-enhanced overview generated for search quality.)`;
  }
}
