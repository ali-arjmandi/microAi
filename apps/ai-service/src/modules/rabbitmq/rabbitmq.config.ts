import { rabbitmqStructureConfig } from '@app/common';

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
  queueName: string;
  routingKey: string;
}

export const getAiEventsExchange = (): string | null =>
  rabbitmqStructureConfig.apps.aiService.exchange.name;

export const getAiQueueName = (): string | null =>
  rabbitmqStructureConfig.apps.aiService.queue;

export const getAiQueueBindingTargets = (): QueueBindingTarget[] => {
  const aiExchange = rabbitmqStructureConfig.apps.aiService
    .exchange as ExchangeDefinition;

  const bindings: QueueBindingTarget[] = [];
  for (const [routingKey, bindQueue] of Object.entries(aiExchange.bind)) {
    for (const targetQueueName of bindQueue) {
      bindings.push({
        exchangeName: aiExchange.name,
        exchangeType: aiExchange.type,
        exchangeDurable: aiExchange.durable,
        queueName: targetQueueName,
        routingKey,
      });
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
