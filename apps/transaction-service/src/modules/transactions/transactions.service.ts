import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AiProcessingStatus,
  CreateTransactionPayload,
  EventEnvelope,
  ModerationStatus,
  SearchIndexStatus,
  SearchTransactionsQuery,
  TransactionCreatedEvent,
  TransactionRecord,
  TransactionState,
} from '@app/common';
import { TransactionModel } from 'apps/transaction-service/prisma/generated/internal/prismaNamespace';
import { PrismaService } from '../database/prisma.service';
import { OutboxRepository } from '../outbox/outbox.repository';
import { TransactionRepository } from './transaction.repository';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionRepository: TransactionRepository,
    private readonly outboxRepository: OutboxRepository,
  ) {}

  async createTransaction(
    payload: CreateTransactionPayload,
  ): Promise<Pick<TransactionRecord, 'transactionId' | 'state'>> {
    const transaction = await this.prisma.$transaction(async (tx) => {
      const created = await this.transactionRepository.create(payload, tx);
      const eventEnvelope: EventEnvelope<TransactionCreatedEvent> = {
        eventId: randomUUID(),
        eventType: 'transaction.created',
        occurredAt: new Date().toISOString(),
        payload: {
          transactionId: created.id,
          title: created.title,
          description: created.description ?? '',
          propertyAddress: created.propertyAddress,
          price: Number(created.price),
          buyerId: created.buyerId,
          sellerId: created.sellerId,
          state: created.state,
        },
      };

      await this.outboxRepository.enqueueTransactionCreated(
        created.id,
        eventEnvelope,
        tx,
      );
      return created;
    });

    return {
      transactionId: transaction.id,
      state: transaction.state as TransactionState,
    };
  }

  async getTransaction(transactionId: string): Promise<TransactionRecord> {
    const transaction = await this.transactionRepository.findById(
      transactionId,
    );
    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} was not found`);
    }

    return this.toTransactionRecord(transaction);
  }

  async searchTransactions({
    query,
  }: SearchTransactionsQuery): Promise<TransactionRecord[]> {
    const transactions = await this.transactionRepository.search(query);
    return transactions.map((item) => this.toTransactionRecord(item));
  }

  private toTransactionRecord(
    transaction: TransactionModel,
  ): TransactionRecord {
    const tags = transaction.searchTags;
    const searchTags = Array.isArray(tags)
      ? tags.filter((t): t is string => typeof t === 'string')
      : undefined;

    return {
      transactionId: transaction.id,
      title: transaction.title,
      description: transaction.description ?? '',
      propertyAddress: transaction.propertyAddress,
      price: Number(transaction.price),
      buyerId: transaction.buyerId,
      sellerId: transaction.sellerId,
      state: transaction.state as TransactionState,
      aiStatus: transaction.aiStatus as AiProcessingStatus,
      searchStatus: transaction.searchStatus as SearchIndexStatus,
      moderationStatus: transaction.moderationStatus as ModerationStatus,
      summary: transaction.summary ?? undefined,
      improvedDescription: transaction.improvedDescription ?? undefined,
      riskNarrative: transaction.riskNarrative ?? undefined,
      riskScore:
        transaction.riskScore !== null && transaction.riskScore !== undefined
          ? Number(transaction.riskScore)
          : undefined,
      moderationReason: transaction.moderationReason ?? undefined,
      moderationConfidence:
        transaction.moderationConfidence !== null &&
        transaction.moderationConfidence !== undefined
          ? Number(transaction.moderationConfidence)
          : undefined,
      searchTags,
      aiModelVersion: transaction.aiModelVersion ?? undefined,
      aiPromptVersion: transaction.aiPromptVersion ?? undefined,
    };
  }
}
