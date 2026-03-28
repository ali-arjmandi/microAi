import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from 'apps/transaction-service/prisma/generated/internal/prismaNamespace';
import { TransactionRepository } from 'apps/transaction-service/src/modules/transactions/transaction.repository';
import { TransactionConsumer } from './transaction.consumer';

describe('TransactionConsumer', () => {
  let consumer: TransactionConsumer;
  let repository: jest.Mocked<
    Pick<
      TransactionRepository,
      'applySearchIndexUpdated' | 'applySearchIndexRejected'
    >
  >;

  beforeEach(async () => {
    repository = {
      applySearchIndexUpdated: jest.fn().mockResolvedValue({}),
      applySearchIndexRejected: jest.fn().mockResolvedValue({}),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionConsumer,
        { provide: TransactionRepository, useValue: repository },
      ],
    }).compile();

    consumer = moduleRef.get(TransactionConsumer);
  });

  it('applies base index outcome from transaction.created', async () => {
    await consumer.handleMessage({
      eventId: 'e1',
      eventType: 'search.index.updated',
      occurredAt: new Date().toISOString(),
      payload: {
        transactionId: 'tx-1',
        searchStatus: 'UPDATED',
        sourceEventId: 'src',
        sourceEventType: 'transaction.created',
      },
    });

    expect(repository.applySearchIndexUpdated).toHaveBeenCalledWith(
      'tx-1',
      'transaction.created',
      undefined,
    );
    expect(repository.applySearchIndexRejected).not.toHaveBeenCalled();
  });

  it('applies enriched index outcome from ai.enriched with enrichment snapshot', async () => {
    const enrichment = {
      summary: 'S',
      riskNarrative: 'R',
      improvedDescription: 'D',
      riskScore: 33,
      tags: ['t1'],
      moderation: {
        status: 'ALLOW' as const,
        reason: 'ok',
        confidence: 0.8,
      },
      model: 'm1',
      promptVersion: 'v1',
    };

    await consumer.handleMessage({
      eventId: 'e2',
      eventType: 'search.index.updated',
      occurredAt: new Date().toISOString(),
      payload: {
        transactionId: 'tx-2',
        searchStatus: 'UPDATED',
        sourceEventId: 'src',
        sourceEventType: 'ai.enriched',
        enrichment,
      },
    });

    expect(repository.applySearchIndexUpdated).toHaveBeenCalledWith(
      'tx-2',
      'ai.enriched',
      enrichment,
    );
  });

  it('strips enrichment when source is not ai.enriched', async () => {
    const enrichment = {
      summary: 'S',
      riskNarrative: 'R',
      improvedDescription: 'D',
      riskScore: 1,
      tags: [] as string[],
      moderation: {
        status: 'ALLOW' as const,
        reason: 'ok',
        confidence: 0.5,
      },
      model: 'm',
      promptVersion: 'v1',
    };

    await consumer.handleMessage({
      eventId: 'e-strip',
      eventType: 'search.index.updated',
      occurredAt: new Date().toISOString(),
      payload: {
        transactionId: 'tx-strip',
        searchStatus: 'UPDATED',
        sourceEventId: 'src',
        sourceEventType: 'transaction.created',
        enrichment,
      },
    });

    expect(repository.applySearchIndexUpdated).toHaveBeenCalledWith(
      'tx-strip',
      'transaction.created',
      undefined,
    );
  });

  it('applies rejected outcome', async () => {
    await consumer.handleMessage({
      eventId: 'e3',
      eventType: 'search.index.rejected',
      occurredAt: new Date().toISOString(),
      payload: {
        transactionId: 'tx-3',
        searchStatus: 'REJECTED',
        reason: 'policy',
        sourceEventId: 'src',
        sourceEventType: 'ai.rejected',
      },
    });

    expect(repository.applySearchIndexRejected).toHaveBeenCalledWith(
      'tx-3',
      'policy',
    );
  });

  it('swallows missing transaction on update', async () => {
    repository.applySearchIndexUpdated.mockRejectedValue(
      new PrismaClientKnownRequestError('record not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(
      consumer.handleMessage({
        eventId: 'e-miss',
        eventType: 'search.index.updated',
        occurredAt: new Date().toISOString(),
        payload: {
          transactionId: 'missing',
          searchStatus: 'UPDATED',
          sourceEventId: 'src',
          sourceEventType: 'transaction.updated',
        },
      }),
    ).resolves.toBeUndefined();
  });

  it('ignores duplicate event ids', async () => {
    const msg = {
      eventId: 'dup',
      eventType: 'search.index.updated',
      occurredAt: new Date().toISOString(),
      payload: {
        transactionId: 'tx-d',
        searchStatus: 'UPDATED',
        sourceEventId: 'src',
        sourceEventType: 'transaction.updated',
      },
    };

    await consumer.handleMessage(msg);
    await consumer.handleMessage(msg);

    expect(repository.applySearchIndexUpdated).toHaveBeenCalledTimes(1);
  });
});
