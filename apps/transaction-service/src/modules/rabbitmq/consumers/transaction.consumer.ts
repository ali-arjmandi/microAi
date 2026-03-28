import {
  EventEnvelope,
  SearchIndexRejectedEventV1,
  SearchIndexUpdatedEnrichmentV1,
  SearchIndexUpdatedEventV1,
} from '@app/common';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaClientKnownRequestError } from 'apps/transaction-service/prisma/generated/internal/prismaNamespace';
import { TransactionRepository } from 'apps/transaction-service/src/modules/transactions/transaction.repository';

@Injectable()
export class TransactionConsumer {
  private readonly logger = new Logger(TransactionConsumer.name);
  private readonly processedEventIds = new Set<string>();
  private readonly processedEventQueue: string[] = [];
  private readonly maxTrackedEventIds = 10_000;

  constructor(private readonly transactionRepository: TransactionRepository) {}

  async handleMessage(payload: unknown): Promise<void> {
    let envelope: EventEnvelope<unknown>;

    try {
      envelope = this.getEnvelope(payload);
    } catch (error) {
      this.logger.warn(
        `Skipping malformed search outcome message: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    if (this.isDuplicateEvent(envelope.eventId)) {
      this.logger.debug(
        `Skipping duplicate search outcome eventId="${envelope.eventId}" eventType="${envelope.eventType}"`,
      );
      return;
    }

    const normalizedEventType = this.normalizeEventType(envelope.eventType);

    if (normalizedEventType === 'search.index.updated') {
      await this.handleSearchIndexUpdated(envelope);
      return;
    }

    if (normalizedEventType === 'search.index.rejected') {
      await this.handleSearchIndexRejected(envelope);
      return;
    }

    this.logger.debug(
      `Ignoring non-search-outcome eventType="${envelope.eventType}" eventId="${envelope.eventId}"`,
    );
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

  private resolveSearchIndexEnrichment(
    payload: Partial<SearchIndexUpdatedEventV1>,
  ): SearchIndexUpdatedEnrichmentV1 | undefined {
    const normalizedSource = this.normalizeEventType(
      payload.sourceEventType ?? '',
    );
    if (normalizedSource !== 'ai.enriched') {
      return undefined;
    }
    const e = payload.enrichment;
    if (!e) {
      return undefined;
    }
    if (!this.isValidSearchIndexEnrichment(e)) {
      this.logger.warn(
        `Ignoring invalid enrichment on search.index.updated from ai.enriched transactionId="${payload.transactionId}"`,
      );
      return undefined;
    }
    return this.normalizeSearchIndexEnrichment(
      e as SearchIndexUpdatedEnrichmentV1,
    );
  }

  private normalizeSearchIndexEnrichment(
    e: SearchIndexUpdatedEnrichmentV1,
  ): SearchIndexUpdatedEnrichmentV1 {
    const status = e.moderation.status.trim().toUpperCase() as
      | 'ALLOW'
      | 'REJECT'
      | 'REVIEW';
    return {
      summary: e.summary.trim(),
      riskNarrative: e.riskNarrative.trim(),
      improvedDescription: e.improvedDescription.trim(),
      riskScore: e.riskScore,
      tags: e.tags.map((t) => t.trim()).filter((t) => t.length > 0),
      model: e.model.trim(),
      promptVersion: e.promptVersion.trim(),
      moderation: {
        status,
        reason: e.moderation.reason.trim(),
        confidence: e.moderation.confidence,
      },
    };
  }

  private isValidSearchIndexEnrichment(
    e: unknown,
  ): e is SearchIndexUpdatedEnrichmentV1 {
    if (!e || typeof e !== 'object') {
      return false;
    }
    const o = e as Record<string, unknown>;
    if (typeof o.summary !== 'string' || !o.summary.trim()) {
      return false;
    }
    if (typeof o.riskNarrative !== 'string' || !o.riskNarrative.trim()) {
      return false;
    }
    if (
      typeof o.improvedDescription !== 'string' ||
      !o.improvedDescription.trim()
    ) {
      return false;
    }
    if (
      typeof o.riskScore !== 'number' ||
      Number.isNaN(o.riskScore) ||
      o.riskScore < 0 ||
      o.riskScore > 100
    ) {
      return false;
    }
    if (!Array.isArray(o.tags)) {
      return false;
    }
    if (!o.tags.every((t) => typeof t === 'string')) {
      return false;
    }
    if (typeof o.model !== 'string' || !o.model.trim()) {
      return false;
    }
    if (typeof o.promptVersion !== 'string' || !o.promptVersion.trim()) {
      return false;
    }
    const mod = o.moderation;
    if (!mod || typeof mod !== 'object') {
      return false;
    }
    const m = mod as Record<string, unknown>;
    const status =
      typeof m.status === 'string' ? m.status.trim().toUpperCase() : '';
    if (status !== 'ALLOW' && status !== 'REJECT' && status !== 'REVIEW') {
      return false;
    }
    if (typeof m.reason !== 'string') {
      return false;
    }
    if (
      typeof m.confidence !== 'number' ||
      Number.isNaN(m.confidence) ||
      m.confidence < 0 ||
      m.confidence > 1
    ) {
      return false;
    }
    return true;
  }

  private async handleSearchIndexUpdated(
    envelope: EventEnvelope<unknown>,
  ): Promise<void> {
    const payload = envelope.payload as Partial<SearchIndexUpdatedEventV1>;
    if (!payload || typeof payload.transactionId !== 'string') {
      this.logger.warn(
        `Skipping search.index.updated with missing transactionId eventId="${envelope.eventId}"`,
      );
      return;
    }

    if (payload.searchStatus !== 'UPDATED') {
      this.logger.warn(
        `Skipping search.index.updated with unexpected searchStatus eventId="${envelope.eventId}"`,
      );
      return;
    }

    if (typeof payload.sourceEventType !== 'string') {
      this.logger.warn(
        `Skipping search.index.updated with missing sourceEventType eventId="${envelope.eventId}"`,
      );
      return;
    }

    const enrichment = this.resolveSearchIndexEnrichment(payload);

    try {
      await this.transactionRepository.applySearchIndexUpdated(
        payload.transactionId,
        payload.sourceEventType,
        enrichment,
      );
    } catch (error) {
      if (this.isRecordNotFoundError(error)) {
        this.logger.warn(
          `No transaction for search.index.updated transactionId="${payload.transactionId}" eventId="${envelope.eventId}"`,
        );
        return;
      }
      if (error instanceof Error && error.message.includes('Unsupported')) {
        this.logger.warn(
          `Unsupported search.index.updated source eventId="${envelope.eventId}" sourceEventType="${payload.sourceEventType}"`,
        );
        return;
      }
      throw error;
    }
  }

  private async handleSearchIndexRejected(
    envelope: EventEnvelope<unknown>,
  ): Promise<void> {
    const payload = envelope.payload as Partial<SearchIndexRejectedEventV1>;
    if (!payload || typeof payload.transactionId !== 'string') {
      this.logger.warn(
        `Skipping search.index.rejected with missing transactionId eventId="${envelope.eventId}"`,
      );
      return;
    }

    if (payload.searchStatus !== 'REJECTED') {
      this.logger.warn(
        `Skipping search.index.rejected with unexpected searchStatus eventId="${envelope.eventId}"`,
      );
      return;
    }

    try {
      await this.transactionRepository.applySearchIndexRejected(
        payload.transactionId,
        payload.reason,
      );
    } catch (error) {
      if (this.isRecordNotFoundError(error)) {
        this.logger.warn(
          `No transaction for search.index.rejected transactionId="${payload.transactionId}" eventId="${envelope.eventId}"`,
        );
        return;
      }
      throw error;
    }
  }

  private isRecordNotFoundError(error: unknown): boolean {
    return (
      error instanceof PrismaClientKnownRequestError && error.code === 'P2025'
    );
  }
}
