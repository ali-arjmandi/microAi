import { rabbitmqStructureConfig } from './rabbitmq-structure.config';
import {
  assertResolvedTopicBindings,
  buildVersionedName,
  collectInboundBindingsForQueue,
  expandOutboundBindings,
  normalizeRoutingKey,
  resolveRabbitMqPrefetch,
  type RabbitMqTopicBootstrapChannel,
} from './rabbitmq-bootstrap';

describe('rabbitmq-bootstrap', () => {
  describe('buildVersionedName', () => {
    it('returns null for empty base', () => {
      expect(buildVersionedName('')).toBeNull();
      expect(buildVersionedName('   ')).toBeNull();
      expect(buildVersionedName(null)).toBeNull();
    });

    it('appends version when present', () => {
      expect(buildVersionedName('transaction.events', 'v1')).toBe(
        'transaction.events.v1',
      );
    });
  });

  describe('normalizeRoutingKey', () => {
    it('strips trailing vN token only', () => {
      expect(normalizeRoutingKey('transaction.created.v2')).toBe(
        'transaction.created',
      );
    });

    it('leaves plain event type unchanged', () => {
      expect(normalizeRoutingKey('ai.enriched')).toBe('ai.enriched');
    });

    it('does not strip non-vN trailing segments', () => {
      expect(normalizeRoutingKey('ai.enriched.prod')).toBe('ai.enriched.prod');
    });
  });

  describe('expandOutboundBindings', () => {
    it('flattens exchange bind map', () => {
      const exchange = rabbitmqStructureConfig.apps.aiService.exchange;
      const bindings = expandOutboundBindings(exchange);
      expect(bindings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            exchangeName: 'ai.events',
            queueName: 'search-service.queue',
            routingKey: 'ai.enriched',
          }),
        ]),
      );
      expect(bindings.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('collectInboundBindingsForQueue', () => {
    it('returns empty for blank queue', () => {
      expect(
        collectInboundBindingsForQueue(rabbitmqStructureConfig.apps, ''),
      ).toEqual([]);
      expect(
        collectInboundBindingsForQueue(rabbitmqStructureConfig.apps, null),
      ).toEqual([]);
    });

    it('finds search outcomes bound to transaction queue', () => {
      const bindings = collectInboundBindingsForQueue(
        rabbitmqStructureConfig.apps,
        'transaction-service.queue',
      );
      expect(bindings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            exchangeName: 'search.events',
            routingKey: 'search.index.updated',
            queueName: 'transaction-service.queue',
          }),
        ]),
      );
    });

    it('finds transaction events bound to ai queue', () => {
      const bindings = collectInboundBindingsForQueue(
        rabbitmqStructureConfig.apps,
        'ai-service.queue',
      );
      expect(bindings.some((b) => b.routingKey === 'transaction.created')).toBe(
        true,
      );
    });

    it('finds transaction and ai bindings for search queue', () => {
      const bindings = collectInboundBindingsForQueue(
        rabbitmqStructureConfig.apps,
        'search-service.queue',
      );
      const keys = new Set(bindings.map((b) => b.routingKey));
      expect(keys.has('transaction.created')).toBe(true);
      expect(keys.has('ai.enriched')).toBe(true);
    });
  });

  describe('assertResolvedTopicBindings', () => {
    it('asserts exchanges, queues, and bindings with versioned names', async () => {
      const assertExchange = jest.fn().mockResolvedValue(undefined);
      const assertQueue = jest.fn().mockResolvedValue(undefined);
      const bindQueue = jest.fn().mockResolvedValue(undefined);
      const channel: RabbitMqTopicBootstrapChannel = {
        assertExchange,
        assertQueue,
        bindQueue,
      };

      await assertResolvedTopicBindings(channel, {
        version: 'v1',
        targets: [
          {
            exchangeName: 'search.events',
            exchangeType: 'topic',
            exchangeDurable: true,
            queueName: 'transaction-service.queue',
            routingKey: 'search.index.updated',
          },
        ],
      });

      expect(assertExchange).toHaveBeenCalledWith('search.events.v1', 'topic', {
        durable: true,
      });
      expect(assertQueue).toHaveBeenCalledWith('transaction-service.queue.v1', {
        durable: true,
      });
      expect(bindQueue).toHaveBeenCalledWith(
        'transaction-service.queue.v1',
        'search.events.v1',
        'search.index.updated',
      );
    });
  });

  describe('resolveRabbitMqPrefetch', () => {
    it('uses fallback for invalid values', () => {
      expect(resolveRabbitMqPrefetch(undefined)).toBe(10);
      expect(resolveRabbitMqPrefetch(NaN)).toBe(10);
      expect(resolveRabbitMqPrefetch(0)).toBe(10);
      expect(resolveRabbitMqPrefetch(-1)).toBe(10);
    });

    it('accepts positive numbers', () => {
      expect(resolveRabbitMqPrefetch(25)).toBe(25);
      expect(resolveRabbitMqPrefetch('8')).toBe(8);
    });
  });
});
