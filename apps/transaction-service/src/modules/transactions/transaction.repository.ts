import { Injectable } from '@nestjs/common';
import { CreateTransactionPayload } from '@app/common';
import { PrismaService } from 'apps/transaction-service/src/modules/database/prisma.service';
import { TransactionClient } from 'apps/transaction-service/prisma/generated/internal/prismaNamespace';
import { TransactionState } from 'apps/transaction-service/prisma/generated/enums';
import { Prisma } from 'apps/transaction-service/prisma/generated/client';

@Injectable()
export class TransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(payload: CreateTransactionPayload, tx?: TransactionClient) {
    const client = tx ?? this.prisma;

    return client.transaction.create({
      data: {
        title: payload.title,
        propertyAddress: payload.propertyAddress,
        price: new Prisma.Decimal(payload.price),
        buyerId: payload.buyerId,
        sellerId: payload.sellerId,
        state: TransactionState.INITIATED,
      },
    });
  }

  findById(transactionId: string) {
    return this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
  }

  search(query?: string) {
    if (!query) {
      return this.prisma.transaction.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.transaction.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { propertyAddress: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  updateState(transactionId: string, state: TransactionState) {
    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: { state },
    });
  }
}
