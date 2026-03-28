import { rabbitmqStructureConfig } from './rabbitmq-structure.config';

export type RabbitMqAppsConfig = typeof rabbitmqStructureConfig.apps;

export interface RabbitMqTopicExchangeConfig {
  readonly name: string;
  readonly type: string;
  readonly durable: boolean;
  readonly bind: Record<string, readonly string[]>;
}

export interface QueueBindingTarget {
  readonly exchangeName: string;
  readonly exchangeType: string;
  readonly exchangeDurable: boolean;
  readonly queueName: string;
  readonly routingKey: string;
}

export interface RabbitMqTopicBootstrapChannel {
  assertExchange(
    exchange: string,
    type: string,
    options: { durable: boolean },
  ): Promise<unknown>;

  assertQueue(queue: string, options: { durable: boolean }): Promise<unknown>;

  bindQueue(
    queue: string,
    source: string,
    routingKey: string,
  ): Promise<unknown>;
}

export function buildVersionedName(
  base: string | null | undefined,
  version?: string,
): string | null {
  const normalizedBase = base?.trim();
  if (!normalizedBase) {
    return null;
  }

  const normalizedVersion = version?.trim();
  if (!normalizedVersion) {
    return normalizedBase;
  }

  return `${normalizedBase}.${normalizedVersion}`;
}

export function normalizeRoutingKey(eventType: string): string {
  const normalizedEventType = eventType.trim();
  const parts = normalizedEventType.split('.');
  const lastPart = parts[parts.length - 1];

  if (!/^v\d+$/u.test(lastPart) || parts.length < 2) {
    return normalizedEventType;
  }

  return parts.slice(0, -1).join('.');
}

export function expandOutboundBindings(
  exchange: RabbitMqTopicExchangeConfig,
): QueueBindingTarget[] {
  const bindings: QueueBindingTarget[] = [];
  for (const [routingKey, bindQueues] of Object.entries(exchange.bind)) {
    for (const targetQueueName of bindQueues) {
      bindings.push({
        exchangeName: exchange.name,
        exchangeType: exchange.type,
        exchangeDurable: exchange.durable,
        queueName: targetQueueName,
        routingKey,
      });
    }
  }
  return bindings;
}

export function collectInboundBindingsForQueue(
  apps: RabbitMqAppsConfig,
  localQueueName: string | null | undefined,
): QueueBindingTarget[] {
  const normalizedQueue = localQueueName?.trim();
  if (!normalizedQueue) {
    return [];
  }

  const bindings: QueueBindingTarget[] = [];
  for (const app of Object.values(apps)) {
    const exchange = app.exchange as RabbitMqTopicExchangeConfig;
    for (const [routingKey, bindQueues] of Object.entries(exchange.bind)) {
      for (const queueName of bindQueues) {
        if (queueName === normalizedQueue) {
          bindings.push({
            exchangeName: exchange.name,
            exchangeType: exchange.type,
            exchangeDurable: exchange.durable,
            queueName: normalizedQueue,
            routingKey,
          });
        }
      }
    }
  }
  return bindings;
}

export async function assertResolvedTopicBindings(
  channel: RabbitMqTopicBootstrapChannel,
  options: {
    version?: string;
    targets: QueueBindingTarget[];
  },
): Promise<void> {
  const { version, targets } = options;

  for (const binding of targets) {
    const bindingExchangeName = buildVersionedName(
      binding.exchangeName,
      version,
    );
    const targetQueueName = buildVersionedName(binding.queueName, version);
    const routingKey = normalizeRoutingKey(binding.routingKey);
    if (!bindingExchangeName || !targetQueueName) {
      continue;
    }

    await channel.assertExchange(bindingExchangeName, binding.exchangeType, {
      durable: binding.exchangeDurable,
    });
    await channel.assertQueue(targetQueueName, { durable: true });
    await channel.bindQueue(targetQueueName, bindingExchangeName, routingKey);
  }
}

export function resolveRabbitMqPrefetch(raw: unknown, fallback = 10): number {
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) {
    return n;
  }
  return fallback;
}
