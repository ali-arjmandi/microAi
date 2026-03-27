import { rabbitmqStructureConfig } from '@app/common';

export interface RabbitMqConfig {
  readonly url: string;
  readonly version?: string;
}

export const rabbitMqConfig = (): RabbitMqConfig => ({
  url: process.env.RABBITMQ_URL ?? '',
  version: process.env.RABBITMQ_VERSION,
});

type ExchangeDefinition = {
  name: string;
  type: string;
  durable: boolean;
  bind: Record<string, readonly string[]>;
};

export interface QueueBindingTarget {
  exchangeName: string;
  exchangeType: string;
  exchangeDurable: boolean;
  routingKey: string;
}

export const getTransactionOutboxExchange = (): string | null =>
  rabbitmqStructureConfig.apps.transactionService.exchange.name;

export const getTransactionQueueName = (): string | null =>
  rabbitmqStructureConfig.apps.transactionService.queue;

export const getTransactionQueueBindingTargets = (): QueueBindingTarget[] => {
  const queueName = getTransactionQueueName();
  if (!queueName) {
    return [];
  }

  const exchanges = Object.values(rabbitmqStructureConfig.apps).map(
    (app) => app.exchange as ExchangeDefinition,
  );

  const bindings: QueueBindingTarget[] = [];
  for (const exchange of exchanges) {
    for (const [routingKey, bindQueue] of Object.entries(exchange.bind)) {
      if (bindQueue.includes(queueName)) {
        bindings.push({
          exchangeName: exchange.name,
          exchangeType: exchange.type,
          exchangeDurable: exchange.durable,
          routingKey,
        });
      }
    }
  }

  return bindings;
};

export const buildVersionedName = (
  base: string | null | undefined,
  version?: string,
): string | null => {
  const normalizedBase = base?.trim();
  if (!normalizedBase) {
    return null;
  }

  const normalizedVersion = version?.trim();
  if (!normalizedVersion) {
    return normalizedBase;
  }

  return `${normalizedBase}.${normalizedVersion}`;
};

export const normalizeRoutingKey = (
  eventType: string,
  version?: string,
): string => {
  const normalizedEventType = eventType.trim();
  const parts = normalizedEventType.split('.');
  const lastPart = parts[parts.length - 1];
  const hasVersionSuffix =
    (Boolean(version) && lastPart === version) || /^v\d+$/u.test(lastPart);
  const baseEventType = hasVersionSuffix
    ? parts.slice(0, -1).join('.')
    : normalizedEventType;

  if (!baseEventType) {
    return normalizedEventType;
  }
  return buildVersionedName(baseEventType, version);
};
