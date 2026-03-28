import {
  collectInboundBindingsForQueue,
  expandOutboundBindings,
  rabbitmqStructureConfig,
} from '@app/common';

export type { QueueBindingTarget } from '@app/common';

export const getAiEventsExchange = (): string | null =>
  rabbitmqStructureConfig.apps.aiService.exchange.name;

export const getAiQueueName = (): string | null =>
  rabbitmqStructureConfig.apps.aiService.queue;

export const getAiQueueBindingTargets = () =>
  expandOutboundBindings(rabbitmqStructureConfig.apps.aiService.exchange);

export const getAiQueueInboundBindingTargets = () =>
  collectInboundBindingsForQueue(
    rabbitmqStructureConfig.apps,
    rabbitmqStructureConfig.apps.aiService.queue,
  );

export { buildVersionedName, normalizeRoutingKey } from '@app/common';
