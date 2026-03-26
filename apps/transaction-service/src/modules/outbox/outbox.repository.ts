import { Injectable } from '@nestjs/common';
import { EventEnvelope, TransactionCreatedEvent } from '@app/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { OutboxStatus } from 'apps/transaction-service/prisma/generated/enums';
import { Prisma } from 'apps/transaction-service/prisma/generated/client';
import { TransactionClient } from 'apps/transaction-service/prisma/generated/internal/prismaNamespace';

@Injectable()
export class OutboxRepository {
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.maxRetries = this.getNumericConfig('OUTBOX_MAX_RETRIES', 5);
    this.retryBaseMs = this.getNumericConfig('OUTBOX_RETRY_BASE_MS', 1_000);
  }

  enqueueTransactionCreated(
    aggregateId: string,
    payload: EventEnvelope<TransactionCreatedEvent>,
    tx?: TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    return client.outboxEvent.create({
      data: {
        aggregateType: 'transaction',
        aggregateId,
        eventType: 'transaction.created',
        payload: payload as unknown as Prisma.InputJsonValue,
        status: OutboxStatus.PENDING,
      },
    });
  }

  listPending(limit = 100, tx?: TransactionClient) {
    const client = tx ?? this.prisma;

    return client.outboxEvent.findMany({
      where: {
        status: OutboxStatus.PENDING,
        availableAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  markPublished(eventId: string, tx?: TransactionClient) {
    const client = tx ?? this.prisma;
    return client.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: OutboxStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
  }

  async markFailed(eventId: string, tx?: TransactionClient) {
    const client = tx ?? this.prisma;
    const event = await client.outboxEvent.findUnique({
      where: { id: eventId },
      select: { retryCount: true },
    });

    if (!event) {
      throw new Error(`Outbox event not found for id=${eventId}`);
    }

    const nextRetryCount = event.retryCount + 1;
    const exceededRetries = nextRetryCount >= this.maxRetries;
    const availableAt = exceededRetries
      ? new Date()
      : new Date(Date.now() + this.calculateBackoffMs(nextRetryCount));

    return client.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: exceededRetries ? OutboxStatus.FAILED : OutboxStatus.PENDING,
        retryCount: { increment: 1 },
        availableAt,
      },
    });
  }

  private calculateBackoffMs(attemptNumber: number): number {
    return this.retryBaseMs * 2 ** Math.max(attemptNumber - 1, 0);
  }

  private getNumericConfig(key: string, fallback: number): number {
    const rawValue = this.configService.get<string | number | undefined>(key);
    const value =
      typeof rawValue === 'number'
        ? rawValue
        : Number.parseInt(rawValue ?? '', 10);

    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
