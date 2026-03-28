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
    };
  }

  async searchTransactions({
    query,
  }: SearchTransactionsQuery): Promise<TransactionRecord[]> {
    const transactions = await this.transactionRepository.search(query);
    return transactions.map((item) => ({
      transactionId: item.id,
      title: item.title,
      description: item.description ?? '',
      propertyAddress: item.propertyAddress,
      price: Number(item.price),
      buyerId: item.buyerId,
      sellerId: item.sellerId,
      state: item.state as TransactionState,
      aiStatus: item.aiStatus as AiProcessingStatus,
      searchStatus: item.searchStatus as SearchIndexStatus,
      moderationStatus: item.moderationStatus as ModerationStatus,
    }));
  }
}
