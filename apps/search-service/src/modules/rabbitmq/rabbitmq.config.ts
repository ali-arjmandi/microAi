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

export const getSearchEventsExchange = (): string | null =>
  rabbitmqStructureConfig.apps.searchService.exchange.name;

export const getSearchQueueName = (): string | null =>
  rabbitmqStructureConfig.apps.searchService.queue;

export const getSearchQueueBindingTargets = () =>
  expandOutboundBindings(rabbitmqStructureConfig.apps.searchService.exchange);

/** Ensures queues this app binds for other services exist when search starts first. */
export const getSearchQueueInboundBindingTargets = () =>
  collectInboundBindingsForQueue(
    rabbitmqStructureConfig.apps,
    rabbitmqStructureConfig.apps.searchService.queue,
  );

export { buildVersionedName, normalizeRoutingKey } from '@app/common';
