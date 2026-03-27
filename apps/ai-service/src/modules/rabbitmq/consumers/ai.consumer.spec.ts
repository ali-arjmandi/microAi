import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiClientService } from '../../ai/ai-client.service';
import { AiEventPublisher } from '../publishers/ai-event.publisher';
import { AiConsumer } from './ai.consumer';

describe('AiConsumer', () => {
  const baseTransaction = {
    transactionId: 'txn-1',
    title: 'House',
    description: 'Nice',
  };

  const allowEnrichment = {
    summary: 's',
    riskNarrative: 'r',
    searchTags: ['tag'],
    improvedDescription: 'd',
    moderation: {
      status: 'ALLOW' as const,
      reason: 'ok',
      confidence: 0.9,
    },
  };

  let consumer: AiConsumer;
  let aiClient: jest.Mocked<Pick<AiClientService, 'generateEnrichment'>>;
  let publisher: jest.Mocked<
    Pick<AiEventPublisher, 'publishEnriched' | 'publishRejected'>
  >;

  beforeEach(async () => {
    aiClient = {
      generateEnrichment: jest.fn().mockResolvedValue(allowEnrichment),
    };
    publisher = {
      publishEnriched: jest.fn().mockResolvedValue(undefined),
      publishRejected: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AiConsumer,
        {
          provide: AiClientService,
          useValue: aiClient,
        },
        {
          provide: AiEventPublisher,
          useValue: publisher,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-model') },
        },
      ],
    }).compile();

    consumer = moduleRef.get(AiConsumer);
  });

  it('publishes at most one enriched event for duplicate deliveries of the same eventId', async () => {
    const envelope = {
      eventId: 'evt-dedupe',
      eventType: 'transaction.created',
      occurredAt: new Date().toISOString(),
      payload: { ...baseTransaction },
    };

    await consumer.handleMessage(envelope);
    await consumer.handleMessage(envelope);

    expect(aiClient.generateEnrichment).toHaveBeenCalledTimes(1);
    expect(publisher.publishEnriched).toHaveBeenCalledTimes(1);
  });

  it('does not run AI for a second message while the first is still in flight (same eventId)', async () => {
    let release: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    aiClient.generateEnrichment.mockImplementation(() =>
      gate.then(() => allowEnrichment),
    );

    const envelope = {
      eventId: 'evt-inflight',
      eventType: 'transaction.created',
      occurredAt: new Date().toISOString(),
      payload: { ...baseTransaction },
    };

    const first = consumer.handleMessage(envelope);
    const second = consumer.handleMessage(envelope);

    await Promise.resolve();
    expect(aiClient.generateEnrichment).toHaveBeenCalledTimes(1);

    release!();
    await Promise.all([first, second]);

    expect(publisher.publishEnriched).toHaveBeenCalledTimes(1);
  });

  it('does not record eventId as processed when validation throws so a retry can succeed', async () => {
    const bad = {
      eventId: 'evt-retry',
      eventType: 'transaction.created',
      occurredAt: new Date().toISOString(),
      payload: {},
    };

    await expect(consumer.handleMessage(bad)).rejects.toThrow(/transactionId/);

    const good = {
      ...bad,
      payload: { ...baseTransaction },
    };
    await consumer.handleMessage(good);

    expect(aiClient.generateEnrichment).toHaveBeenCalledTimes(1);
    expect(publisher.publishEnriched).toHaveBeenCalledTimes(1);
  });
});
