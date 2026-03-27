import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsumeMessage } from 'amqplib';
import { AiConsumer } from './consumers/ai.consumer';
import { RabbitMqConnectionService } from './rabbitmq.connection.service';
import {
  buildVersionedName,
  getAiEventsExchange,
  getAiQueueBindingTargets,
  getAiQueueName,
  normalizeRoutingKey,
} from './rabbitmq.config';

@Injectable()
export class RabbitMqStartupService {
  private readonly logger = new Logger(RabbitMqStartupService.name);

  constructor(
    private readonly connectionService: RabbitMqConnectionService,
    private readonly configService: ConfigService,
    private readonly aiConsumer: AiConsumer,
  ) {}

  async initialize(): Promise<void> {
    const version = this.configService.get<string>('RABBITMQ_VERSION');
    const aiEventsExchangeName = buildVersionedName(
      getAiEventsExchange(),
      version,
    );
    const queueName = buildVersionedName(getAiQueueName(), version);
    const bindingTargets = getAiQueueBindingTargets();

    try {
      if (!aiEventsExchangeName && !queueName) {
        this.logger.log(
          'RabbitMQ startup skipped: ai exchange and queue are not configured',
        );
        return;
      }

      await this.connectionService.connect();
      const channel = this.connectionService.getChannel();
      const prefetch = Number(
        this.configService.get<number>('RABBITMQ_PREFETCH'),
      );

      if (queueName) {
        await channel.assertQueue(queueName, { durable: true });
      }

      if (aiEventsExchangeName) {
        await channel.assertExchange(aiEventsExchangeName, 'topic', {
          durable: true,
        });
      }

      if (queueName && bindingTargets.length > 0) {
        for (const binding of bindingTargets) {
          const bindingExchangeName = buildVersionedName(
            binding.exchangeName,
            version,
          );
          const targetQueueName = buildVersionedName(
            binding.queueName,
            version,
          );
          const routingKey = normalizeRoutingKey(binding.routingKey, version);
          if (!bindingExchangeName || !targetQueueName) {
            continue;
          }

          await channel.assertExchange(
            bindingExchangeName,
            binding.exchangeType,
            {
              durable: binding.exchangeDurable,
            },
          );
          await channel.assertQueue(targetQueueName, { durable: true });
          await channel.bindQueue(
            targetQueueName,
            bindingExchangeName,
            routingKey,
          );
        }
      }

      if (queueName) {
        await channel.prefetch(prefetch);
        await channel.consume(
          queueName,
          async (message: ConsumeMessage | null) => {
            if (!message) {
              return;
            }

            try {
              const decodedContent = message.content.toString('utf-8');
              const payload = JSON.parse(decodedContent) as unknown;
              const meta =
                payload && typeof payload === 'object'
                  ? (payload as { eventId?: string; eventType?: string })
                  : undefined;
              this.logger.debug(
                JSON.stringify({
                  msg: 'Consumed RabbitMQ message',
                  queue: queueName,
                  eventId: meta?.eventId,
                  eventType: meta?.eventType,
                }),
              );
              await this.aiConsumer.handleMessage(payload);
              channel.ack(message);
            } catch (error) {
              this.logger.error(
                `Failed to process message from queue "${queueName}"`,
                error instanceof Error ? error.stack : String(error),
              );
              channel.nack(message, false, false);
            }
          },
          { noAck: false },
        );
      }

      this.logger.log(
        `RabbitMQ startup ready: exchange=${
          aiEventsExchangeName ?? 'none'
        }, queue=${queueName ?? 'none'}, prefetch=${prefetch}, bindings=${
          bindingTargets.length
        }`,
      );
    } catch (error) {
      this.logger.error(
        `RabbitMQ startup bootstrap failed for queue "${queueName ?? 'none'}"`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
