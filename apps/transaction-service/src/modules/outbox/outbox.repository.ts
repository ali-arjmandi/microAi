import { Injectable } from '@nestjs/common';
import { EventEnvelope, TransactionCreatedEvent } from '@app/common';
import { PrismaService } from '../database/prisma.service';
import { OutboxStatus } from 'apps/transaction-service/prisma/generated/enums';
import { Prisma } from 'apps/transaction-service/prisma/generated/client';

@Injectable()
export class OutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  enqueueTransactionCreated(
    aggregateId: string,
    payload: EventEnvelope<TransactionCreatedEvent>,
    tx?: any,
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

  listPending(limit = 100) {
    return this.prisma.outboxEvent.findMany({
      where: { status: OutboxStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  markPublished(eventId: string) {
    return this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: OutboxStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
  }

  markFailed(eventId: string) {
    return this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: OutboxStatus.FAILED,
        retryCount: { increment: 1 },
      },
    });
  }
}
