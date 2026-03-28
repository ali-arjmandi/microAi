import {
  collectInboundBindingsForQueue,
  expandOutboundBindings,
  rabbitmqStructureConfig,
} from '@app/common';

export interface RabbitMqConfig {
  readonly url: string;
  readonly version?: string;
}

export const rabbitMqConfig = (): RabbitMqConfig => ({
  url: process.env.RABBITMQ_URL ?? '',
  version: process.env.RABBITMQ_VERSION,
});

export type { QueueBindingTarget } from '@app/common';

export const getTransactionOutboxExchange = (): string | null =>
  rabbitmqStructureConfig.apps.transactionService.exchange.name;

export const getTransactionQueueName = (): string | null =>
  rabbitmqStructureConfig.apps.transactionService.queue;

export const getTransactionQueueBindingTargets = () =>
  expandOutboundBindings(
    rabbitmqStructureConfig.apps.transactionService.exchange,
  );

export const getTransactionQueueInboundBindingTargets = () =>
  collectInboundBindingsForQueue(
    rabbitmqStructureConfig.apps,
    rabbitmqStructureConfig.apps.transactionService.queue,
  );

export { buildVersionedName, normalizeRoutingKey } from '@app/common';
