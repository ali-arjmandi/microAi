import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiClientService } from '../../ai/ai-client.service';
import { AiModelOutputInvalidError } from '../../ai/ai-model-output.error';
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
    riskScore: 12,
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

  it('publishes ai.enriched with payload on successful ALLOW enrichment', async () => {
    const envelope = {
      eventId: 'evt-success',
      eventType: 'transaction.created',
      occurredAt: new Date().toISOString(),
      payload: { ...baseTransaction },
    };

    await consumer.handleMessage(envelope);

    expect(publisher.publishEnriched).toHaveBeenCalledTimes(1);
    expect(publisher.publishRejected).not.toHaveBeenCalled();
    const call = publisher.publishEnriched.mock.calls[0][0];
    expect(call.eventType).toBe('ai.enriched');
    expect(call.payload.transactionId).toBe('txn-1');
    expect(call.payload.summary).toBe('s');
    expect(call.payload.model).toBe('test-model');
    expect(call.payload.promptVersion).toBe('v1');
  });

  it('publishes ai.rejected when moderation status is REJECT', async () => {
    aiClient.generateEnrichment.mockResolvedValue({
      ...allowEnrichment,
      moderation: {
        status: 'REJECT',
        reason: 'not_real_estate_listing',
        confidence: 0.99,
      },
    });

    const envelope = {
      eventId: 'evt-reject-mod',
      eventType: 'transaction.created',
      occurredAt: new Date().toISOString(),
      payload: { ...baseTransaction },
    };

    await consumer.handleMessage(envelope);

    expect(publisher.publishRejected).toHaveBeenCalledTimes(1);
    expect(publisher.publishEnriched).not.toHaveBeenCalled();
    const call = publisher.publishRejected.mock.calls[0][0];
    expect(call.eventType).toBe('ai.rejected');
    expect(call.payload.transactionId).toBe('txn-1');
    expect(call.payload.reason).toBe('not_real_estate_listing');
    expect(call.payload.model).toBe('test-model');
  });

  it('publishes ai.rejected on invalid model output and dedupes duplicate deliveries', async () => {
    aiClient.generateEnrichment.mockRejectedValue(
      new AiModelOutputInvalidError(
        'schema_validation_failed',
        'invalid',
        'detail',
      ),
    );

    const envelope = {
      eventId: 'evt-invalid-out',
      eventType: 'transaction.created',
      occurredAt: new Date().toISOString(),
      payload: { ...baseTransaction },
    };

    await consumer.handleMessage(envelope);
    await consumer.handleMessage(envelope);

    expect(aiClient.generateEnrichment).toHaveBeenCalledTimes(1);
    expect(publisher.publishRejected).toHaveBeenCalledTimes(1);
    expect(publisher.publishEnriched).not.toHaveBeenCalled();
    const call = publisher.publishRejected.mock.calls[0][0];
    expect(call.payload.reason).toBe('schema_validation_failed');
    expect(call.payload.detail).toBe('detail');
  });

  it('does not publish again for duplicate delivery after moderation REJECT', async () => {
    aiClient.generateEnrichment.mockResolvedValue({
      ...allowEnrichment,
      moderation: {
        status: 'REJECT',
        reason: 'policy_inappropriate_content',
        confidence: 0.9,
      },
    });

    const envelope = {
      eventId: 'evt-reject-dedupe',
      eventType: 'transaction.created',
      occurredAt: new Date().toISOString(),
      payload: { ...baseTransaction },
    };

    await consumer.handleMessage(envelope);
    await consumer.handleMessage(envelope);

    expect(aiClient.generateEnrichment).toHaveBeenCalledTimes(1);
    expect(publisher.publishRejected).toHaveBeenCalledTimes(1);
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
    const releaseRef: { resolve?: () => void } = {};
    const gate = new Promise<void>((resolve) => {
      releaseRef.resolve = resolve;
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

    releaseRef.resolve?.();
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
