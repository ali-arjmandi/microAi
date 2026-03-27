import {
  AiEnrichedEvent,
  AiRejectedEventV1,
  EventEnvelope,
  TransactionCreatedEvent,
  TransactionUpdatedEvent,
} from '@app/common';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { AiClientService } from '../../ai/ai-client.service';
import { AiModelOutputInvalidError } from '../../ai/ai-model-output.error';
import { ListingEnrichmentInput } from '../../ai/ai.types';
import { AiEventPublisher } from '../publishers/ai-event.publisher';

type TransactionPayload = TransactionCreatedEvent | TransactionUpdatedEvent;

@Injectable()
export class AiConsumer {
  private readonly logger = new Logger(AiConsumer.name);
  private readonly processedEventIds = new Set<string>();
  private readonly processedEventQueue: string[] = [];
  private readonly maxTrackedEventIds = 10_000;

  constructor(
    private readonly aiClientService: AiClientService,
    private readonly aiEventPublisher: AiEventPublisher,
    private readonly configService: ConfigService,
  ) {}

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

    const model =
      this.configService.get<string>('OPENROUTER_MODEL') ?? 'openrouter/free';
    const promptVersion = 'v1';
    try {
      const listingContext = this.buildListingEnrichmentInput(transaction);
      const enrichment = await this.aiClientService.generateEnrichment(
        listingContext,
      );

      if (enrichment.moderation.status === 'REJECT') {
        const rejectedEnvelope: EventEnvelope<AiRejectedEventV1> = {
          eventId: randomUUID(),
          eventType: 'ai.rejected',
          occurredAt: new Date().toISOString(),
          payload: {
            transactionId: transaction.transactionId,
            reason: enrichment.moderation.reason,
            model,
            promptVersion,
          },
        };
        await this.aiEventPublisher.publishRejected(rejectedEnvelope);
        return;
      }

      const enrichedEnvelope: EventEnvelope<AiEnrichedEvent> = {
        eventId: randomUUID(),
        eventType: 'ai.enriched',
        occurredAt: new Date().toISOString(),
        payload: {
          transactionId: transaction.transactionId,
          summary: enrichment.summary,
          riskNarrative: enrichment.riskNarrative,
          tags: enrichment.searchTags,
          improvedDescription: enrichment.improvedDescription,
          moderation: enrichment.moderation,
          model,
          promptVersion,
        },
      };

      await this.aiEventPublisher.publishEnriched(enrichedEnvelope);
    } catch (error) {
      if (error instanceof AiModelOutputInvalidError) {
        this.logger.warn(
          `AI model output invalid eventId="${envelope.eventId}" code="${error.code}"${error.detail ? ` detail="${error.detail}"` : ''}`,
        );
        const rejectedEnvelope: EventEnvelope<AiRejectedEventV1> = {
          eventId: randomUUID(),
          eventType: 'ai.rejected',
          occurredAt: new Date().toISOString(),
          payload: {
            transactionId: transaction.transactionId,
            reason: error.code,
            model,
            promptVersion,
            detail: error.detail,
          },
        };
        await this.aiEventPublisher.publishRejected(rejectedEnvelope);
        return;
      }

      this.logger.error(
        `AI processing failed for eventId="${envelope.eventId}": ${String(
          error,
        )}`,
      );
      const rejectedEnvelope: EventEnvelope<AiRejectedEventV1> = {
        eventId: randomUUID(),
        eventType: 'ai.rejected',
        occurredAt: new Date().toISOString(),
        payload: {
          transactionId: transaction.transactionId,
          reason: 'processing_error',
          model,
          promptVersion,
        },
      };
      await this.aiEventPublisher.publishRejected(rejectedEnvelope);
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

  private getTransactionPayload(payload: unknown): TransactionPayload {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Event payload must be an object');
    }
    return payload as TransactionPayload;
  }

  private buildListingEnrichmentInput(
    transaction: TransactionPayload,
  ): ListingEnrichmentInput {
    return {
      title: transaction.title,
      description: transaction.description,
      propertyAddress: transaction.propertyAddress,
      price: transaction.price,
      state: transaction.state,
    };
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
}
