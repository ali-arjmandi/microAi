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
      }),
    );
    expect(publisherMock.publish).not.toHaveBeenCalled();
  });
});
