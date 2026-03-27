import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTransactionPayload } from '@app/common';
import { PrismaService } from 'apps/transaction-service/src/modules/database/prisma.service';
import {
  TransactionClient,
  TransactionModel,
} from 'apps/transaction-service/prisma/generated/internal/prismaNamespace';
import { TransactionState } from 'apps/transaction-service/prisma/generated/enums';
import { Prisma } from 'apps/transaction-service/prisma/generated/client';

@Injectable()
export class TransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    payload: CreateTransactionPayload,
    tx?: TransactionClient,
  ): Promise<TransactionModel> {
    const client = tx ?? this.prisma;

    return client.transaction.create({
      data: {
        title: payload.title,
        description: payload.description,
        propertyAddress: payload.propertyAddress,
        price: new Prisma.Decimal(payload.price),
        buyerId: payload.buyerId,
        sellerId: payload.sellerId,
        state: TransactionState.INITIATED,
      },
    });
  }

  findById(
    transactionId: string,
    tx?: TransactionClient,
  ): Promise<TransactionModel> {
    const client = tx ?? this.prisma;

    return client.transaction.findUnique({
      where: { id: transactionId },
    });
  }

  search(query?: string, tx?: TransactionClient): Promise<TransactionModel[]> {
    const client = tx ?? this.prisma;

    if (!query) {
      return client.transaction.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }

    return client.transaction.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { propertyAddress: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  updateState(
    transactionId: string,
    state: TransactionState,
    tx?: TransactionClient,
  ) {
    const client = tx ?? this.prisma;

    return client.transaction.update({
      where: { id: transactionId },
      data: { state },
    });
  }

  async updateStateOptimistic(
    transactionId: string,
    state: TransactionState,
    expectedVersion: number,
    tx?: TransactionClient,
  ): Promise<TransactionModel> {
    const client = tx ?? this.prisma;
    const updateResult = await client.transaction.updateMany({
      where: {
        id: transactionId,
        version: expectedVersion,
      },
      data: {
        state,
        version: { increment: 1 },
      },
    });

    if (updateResult.count === 1) {
      return client.transaction.findUnique({
        where: { id: transactionId },
      });
    }

    const current = await client.transaction.findUnique({
      where: { id: transactionId },
      select: { version: true },
    });

    if (!current) {
      throw new NotFoundException(`Transaction ${transactionId} was not found`);
    }

    throw new ConflictException(
      `Optimistic lock conflict for transaction ${transactionId}. Expected version ${expectedVersion}, current version ${current.version}.`,
    );
  }
}
