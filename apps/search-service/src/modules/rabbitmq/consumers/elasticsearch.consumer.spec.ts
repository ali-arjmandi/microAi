import { ElasticsearchConsumer } from './elasticsearch.consumer';
import { IndexingService } from '../../elasticsearch/elasticsearch.indexing.service';
import { ElasticsearchEventPublisher } from '../publishers/elasticsearch-event.publisher';

describe('ElasticsearchConsumer', () => {
  let consumer: ElasticsearchConsumer;
  const indexingServiceMock = {
    getDocument: jest.fn(),
    upsertDocument: jest.fn(),
    deleteDocument: jest.fn(),
  };
  const publisherMock = {
    publish: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    indexingServiceMock.getDocument.mockResolvedValue(null);
    consumer = new ElasticsearchConsumer(
      indexingServiceMock as unknown as IndexingService,
      publisherMock as unknown as ElasticsearchEventPublisher,
    );
  });

  it('upserts and publishes status for transaction.created events', async () => {
    await consumer.handleMessage({
      eventId: 'evt-1',
      eventType: 'transaction.created',
      occurredAt: '2026-03-27T00:00:00.000Z',
      payload: {
        transactionId: 'tx-1',
        title: 'Home sale',
        description: 'Sunny two-bedroom condo near city center',
      },
    });

    expect(indexingServiceMock.upsertDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 'tx-1',
        description: 'Sunny two-bedroom condo near city center',
        searchStatus: 'READY',
        lastBaseEventOccurredAt: '2026-03-27T00:00:00.000Z',
        eventId: 'evt-1',
        eventType: 'transaction.created',
      }),
    );
    expect(publisherMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'search.index.updated',
        payload: expect.objectContaining({
          transactionId: 'tx-1',
          searchStatus: 'UPDATED',
          sourceEventId: 'evt-1',
        }),
      }),
    );
  });

  it('skips duplicate eventIds for idempotency', async () => {
    const message = {
      eventId: 'evt-dup',
      eventType: 'transaction.created',
      occurredAt: '2026-03-27T00:00:00.000Z',
      payload: {
        transactionId: 'tx-dup',
      },
    };

    await consumer.handleMessage(message);
    await consumer.handleMessage(message);

    expect(indexingServiceMock.upsertDocument).toHaveBeenCalledTimes(1);
    expect(publisherMock.publish).toHaveBeenCalledTimes(1);
  });

  it('sets pending base status when AI arrives before base transaction', async () => {
    indexingServiceMock.getDocument.mockResolvedValueOnce(null);

    await consumer.handleMessage({
      eventId: 'evt-ai-first',
      eventType: 'ai.enriched',
      occurredAt: '2026-03-27T00:00:00.000Z',
      payload: {
        transactionId: 'tx-ai-first',
        summary: 'AI summary',
        tags: ['urgent'],
      },
    });

    expect(indexingServiceMock.upsertDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 'tx-ai-first',
        searchStatus: 'PENDING_BASE',
        aiStatus: 'COMPLETED',
        moderationStatus: 'ALLOW',
        lastAiEventOccurredAt: '2026-03-27T00:00:00.000Z',
      }),
    );
    expect(publisherMock.publish).not.toHaveBeenCalled();
  });

  it('ignores stale transaction upserts based on lastBaseEventOccurredAt', async () => {
    indexingServiceMock.getDocument.mockResolvedValueOnce({
      transactionId: 'tx-old',
      title: 'Newer title',
      lastBaseEventOccurredAt: '2026-03-27T02:00:00.000Z',
    });

    await consumer.handleMessage({
      eventId: 'evt-stale-tx',
      eventType: 'transaction.updated',
      occurredAt: '2026-03-27T01:00:00.000Z',
      payload: {
        transactionId: 'tx-old',
        title: 'Stale title',
      },
    });

    expect(indexingServiceMock.upsertDocument).not.toHaveBeenCalled();
    expect(publisherMock.publish).not.toHaveBeenCalled();
  });

  it('ignores stale ai.enriched based on lastAiEventOccurredAt', async () => {
    indexingServiceMock.getDocument.mockResolvedValueOnce({
      transactionId: 'tx-ai-order',
      title: 'Has base',
      summary: 'Newer summary',
      lastAiEventOccurredAt: '2026-03-27T02:00:00.000Z',
    });

    await consumer.handleMessage({
      eventId: 'evt-stale-ai',
      eventType: 'ai.enriched',
      occurredAt: '2026-03-27T01:00:00.000Z',
      payload: {
        transactionId: 'tx-ai-order',
        summary: 'Stale summary',
      },
    });

    expect(indexingServiceMock.upsertDocument).not.toHaveBeenCalled();
  });

  it('does not publish rejected until base exists, then transaction upsert publishes rejected', async () => {
    indexingServiceMock.getDocument
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        transactionId: 'tx-pend-rej',
        moderationStatus: 'REJECT',
        moderationReason: 'policy',
        searchStatus: 'PENDING_BASE',
        lastAiEventOccurredAt: '2026-03-27T01:00:00.000Z',
      });

    await consumer.handleMessage({
      eventId: 'evt-ai-rej',
      eventType: 'ai.rejected',
      occurredAt: '2026-03-27T01:00:00.000Z',
      payload: {
        transactionId: 'tx-pend-rej',
        reason: 'policy',
      },
    });

    expect(publisherMock.publish).not.toHaveBeenCalled();

    await consumer.handleMessage({
      eventId: 'evt-base-after-rej',
      eventType: 'transaction.created',
      occurredAt: '2026-03-27T02:00:00.000Z',
      payload: {
        transactionId: 'tx-pend-rej',
        title: 'Listed',
      },
    });

    expect(indexingServiceMock.upsertDocument).toHaveBeenLastCalledWith(
      expect.objectContaining({
        transactionId: 'tx-pend-rej',
        searchStatus: 'FAILED',
        lastBaseEventOccurredAt: '2026-03-27T02:00:00.000Z',
      }),
    );
    expect(publisherMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'search.index.rejected',
        payload: expect.objectContaining({
          transactionId: 'tx-pend-rej',
          searchStatus: 'REJECTED',
        }),
      }),
    );
  });

  it('publishes search.index.updated for transaction when moderation is not rejected', async () => {
    indexingServiceMock.getDocument.mockResolvedValueOnce({
      transactionId: 'tx-ok',
      title: 'A',
      moderationStatus: 'ALLOW',
    });

    await consumer.handleMessage({
      eventId: 'evt-tx-2',
      eventType: 'transaction.updated',
      occurredAt: '2026-03-27T03:00:00.000Z',
      payload: {
        transactionId: 'tx-ok',
        title: 'B',
      },
    });

    expect(publisherMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'search.index.updated' }),
    );
  });

  it('publishes search.index.updated with enrichment when ai.enriched and base data exists', async () => {
    indexingServiceMock.getDocument.mockResolvedValueOnce({
      transactionId: 'tx-enr',
      title: 'Has base',
    });

    await consumer.handleMessage({
      eventId: 'evt-ai-full',
      eventType: 'ai.enriched',
      occurredAt: '2026-03-27T00:00:00.000Z',
      payload: {
        transactionId: 'tx-enr',
        summary: 'S',
        riskNarrative: 'R',
        improvedDescription: 'D',
        riskScore: 42,
        tags: ['a', 'b'],
        moderation: { status: 'ALLOW', reason: 'ok', confidence: 0.9 },
        model: 'test-model',
        promptVersion: 'v1',
      },
    });

    expect(publisherMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'search.index.updated',
        payload: expect.objectContaining({
          transactionId: 'tx-enr',
          searchStatus: 'UPDATED',
          enrichment: expect.objectContaining({
            summary: 'S',
            riskScore: 42,
            tags: ['a', 'b'],
            model: 'test-model',
            promptVersion: 'v1',
            moderation: expect.objectContaining({
              status: 'ALLOW',
              reason: 'ok',
              confidence: 0.9,
            }),
          }),
        }),
      }),
    );
  });
});
