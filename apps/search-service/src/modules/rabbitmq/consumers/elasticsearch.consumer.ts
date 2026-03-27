import { EventEnvelope } from '@app/common';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IndexingService } from '../../elasticsearch/elasticsearch.indexing.service';
import { ElasticsearchEventPublisher } from '../publishers/elasticsearch-event.publisher';
import { SearchDocument } from '../../elasticsearch/search-document.model';

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

interface SearchStatusUpdatedPayload {
  transactionId: string;
  searchStatus: 'UPDATED';
  sourceEventId: string;
  sourceEventType: string;
}

interface SearchStatusRejectedPayload {
  transactionId: string;
  searchStatus: 'REJECTED';
  reason?: string;
  sourceEventId: string;
  sourceEventType: string;
}

@Injectable()
export class ElasticsearchConsumer {
  private readonly logger = new Logger(ElasticsearchConsumer.name);
  private readonly processedEventIds = new Set<string>();
  private readonly processedEventQueue: string[] = [];
  private readonly maxTrackedEventIds = 10_000;

  constructor(
    private readonly indexingService: IndexingService,
    private readonly searchEventPublisher: ElasticsearchEventPublisher,
  ) {}

  async handleMessage(payload: unknown): Promise<void> {
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

    this.logger.log(
      JSON.stringify({
        msg: 'Processing search event',
        eventId: envelope.eventId,
        eventType: envelope.eventType,
      }),
    );

    const normalizedEventType = this.normalizeEventType(envelope.eventType);

    let handled = true;
    switch (normalizedEventType) {
      case 'transaction.created':
      case 'transaction.updated':
        await this.handleTransactionUpsert(envelope);
        break;
      case 'transaction.deleted':
        await this.handleTransactionDelete(envelope);
        break;
      case 'ai.enriched':
        await this.handleAiEnriched(envelope);
        break;
      case 'ai.rejected':
        await this.handleAiRejected(envelope);
        break;
      default:
        handled = false;
        this.logger.warn(
          `Ignoring unsupported eventType="${envelope.eventType}" eventId="${envelope.eventId}"`,
        );
    }

    if (handled) {
      this.logger.log(
        JSON.stringify({
          msg: 'Processed search event',
          eventId: envelope.eventId,
          eventType: envelope.eventType,
        }),
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

  private async handleTransactionUpsert(
    envelope: EventEnvelope<unknown>,
  ): Promise<void> {
    const payload = this.getRecordPayload(envelope.payload);
    if (typeof payload.transactionId !== 'string') {
      this.logger.warn(
        `Skipping event with missing transactionId eventId="${envelope.eventId}" eventType="${envelope.eventType}"`,
      );
      return;
    }

    const transactionPayload = payload as unknown as TransactionUpsertPayload;
    const existingDocument = await this.indexingService.getDocument(
      transactionPayload.transactionId,
    );
    const isModerationRejected = this.isModerationRejected(existingDocument);

    await this.indexingService.upsertDocument({
      transactionId: transactionPayload.transactionId,
      title: transactionPayload.title,
      propertyAddress: transactionPayload.propertyAddress,
      price: transactionPayload.price,
      buyerId: transactionPayload.buyerId,
      sellerId: transactionPayload.sellerId,
      state: transactionPayload.state,
      searchStatus: isModerationRejected ? 'FAILED' : 'READY',
      eventType: envelope.eventType,
      eventId: envelope.eventId,
      occurredAt: envelope.occurredAt,
    });

    await this.publishStatusUpdated(envelope, transactionPayload.transactionId);
  }

  private async handleTransactionDelete(
    envelope: EventEnvelope<unknown>,
  ): Promise<void> {
    const payload = this.getRecordPayload(
      envelope.payload,
    ) as unknown as TransactionDeletePayload;
    if (!payload.transactionId) {
      this.logger.warn(
        `Skipping delete event with missing transactionId eventId="${envelope.eventId}"`,
      );
      return;
    }

    await this.indexingService.deleteDocument(payload.transactionId);
  }

  private async handleAiEnriched(
    envelope: EventEnvelope<unknown>,
  ): Promise<void> {
    const payload = this.getRecordPayload(
      envelope.payload,
    ) as unknown as AiEnrichedPayload;
    if (!payload.transactionId) {
      this.logger.warn(
        `Skipping AI enriched event with missing transactionId eventId="${envelope.eventId}"`,
      );
      return;
    }

    const existingDocument = await this.indexingService.getDocument(
      payload.transactionId,
    );
    const hasBaseTransactionData =
      this.hasBaseTransactionData(existingDocument);
    const nextSearchStatus = hasBaseTransactionData ? 'READY' : 'PENDING_BASE';

    await this.indexingService.upsertDocument({
      transactionId: payload.transactionId,
      summary: payload.summary,
      improvedDescription: payload.improvedDescription,
      riskNarrative: payload.riskNarrative,
      tags: Array.isArray(payload.tags)
        ? payload.tags.filter((tag) => typeof tag === 'string')
        : undefined,
      aiStatus: 'COMPLETED',
      moderationStatus: 'ALLOW',
      searchStatus: nextSearchStatus,
      eventType: envelope.eventType,
      eventId: envelope.eventId,
      occurredAt: envelope.occurredAt,
    });

    if (hasBaseTransactionData) {
      await this.publishStatusUpdated(envelope, payload.transactionId);
    }
  }

  private async handleAiRejected(
    envelope: EventEnvelope<unknown>,
  ): Promise<void> {
    const payload = this.getRecordPayload(
      envelope.payload,
    ) as unknown as AiRejectedPayload;
    if (!payload.transactionId) {
      this.logger.warn(
        `Skipping AI rejected event with missing transactionId eventId="${envelope.eventId}"`,
      );
      return;
    }

    const existingDocument = await this.indexingService.getDocument(
      payload.transactionId,
    );
    const hasBaseTransactionData =
      this.hasBaseTransactionData(existingDocument);

    await this.indexingService.upsertDocument({
      transactionId: payload.transactionId,
      moderationStatus: 'REJECT',
      moderationReason: payload.reason,
      aiStatus: 'FAILED',
      searchStatus: hasBaseTransactionData ? 'FAILED' : 'PENDING_BASE',
      eventType: envelope.eventType,
      eventId: envelope.eventId,
      occurredAt: envelope.occurredAt,
    });

    await this.publishStatusRejected(
      envelope,
      payload.transactionId,
      payload.reason,
    );
  }

  private getRecordPayload(payload: unknown): Record<string, unknown> {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Event payload must be an object');
    }
    return payload as Record<string, unknown>;
  }

  private hasBaseTransactionData(
    doc: SearchDocument | null | undefined,
  ): boolean {
    if (!doc) {
      return false;
    }
    return Boolean(
      doc.title ||
        doc.propertyAddress ||
        doc.price !== undefined ||
        doc.buyerId ||
        doc.sellerId ||
        doc.state ||
        doc.transactionState,
    );
  }

  private isModerationRejected(
    doc: SearchDocument | null | undefined,
  ): boolean {
    return doc?.moderationStatus?.trim().toUpperCase() === 'REJECT';
  }

  private async publishStatusUpdated(
    sourceEnvelope: EventEnvelope<unknown>,
    transactionId: string,
  ): Promise<void> {
    const payload: SearchStatusUpdatedPayload = {
      transactionId,
      searchStatus: 'UPDATED',
      sourceEventId: sourceEnvelope.eventId,
      sourceEventType: sourceEnvelope.eventType,
    };

    await this.searchEventPublisher.publish({
      eventId: randomUUID(),
      eventType: 'search.index.updated',
      occurredAt: new Date().toISOString(),
      payload,
    });
    this.logger.log(
      JSON.stringify({
        msg: 'Published search status updated',
        transactionId,
        sourceEventId: sourceEnvelope.eventId,
        sourceEventType: sourceEnvelope.eventType,
      }),
    );
  }

  private async publishStatusRejected(
    sourceEnvelope: EventEnvelope<unknown>,
    transactionId: string,
    reason?: string,
  ): Promise<void> {
    const payload: SearchStatusRejectedPayload = {
      transactionId,
      searchStatus: 'REJECTED',
      reason,
      sourceEventId: sourceEnvelope.eventId,
      sourceEventType: sourceEnvelope.eventType,
    };

    await this.searchEventPublisher.publish({
      eventId: randomUUID(),
      eventType: 'search.index.rejected',
      occurredAt: new Date().toISOString(),
      payload,
    });
    this.logger.log(
      JSON.stringify({
        msg: 'Published search status rejected',
        transactionId,
        reason,
        sourceEventId: sourceEnvelope.eventId,
        sourceEventType: sourceEnvelope.eventType,
      }),
    );
  }
}
