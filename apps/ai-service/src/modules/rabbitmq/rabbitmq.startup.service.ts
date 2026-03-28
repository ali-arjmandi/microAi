import {
  assertResolvedTopicBindings,
  buildVersionedName,
  resolveRabbitMqPrefetch,
} from '@app/common';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsumeMessage } from 'amqplib';
import { AiConsumer } from './consumers/ai.consumer';
import { RabbitMqConnectionService } from './rabbitmq.connection.service';
import {
  getAiEventsExchange,
  getAiQueueBindingTargets,
  getAiQueueInboundBindingTargets,
  getAiQueueName,
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
    const outboundBindingTargets = getAiQueueBindingTargets();
    const inboundBindingTargets = getAiQueueInboundBindingTargets();

    try {
      if (!aiEventsExchangeName && !queueName) {
        this.logger.log(
          'RabbitMQ startup skipped: ai exchange and queue are not configured',
        );
        return;
      }

      await this.connectionService.connect();
      const channel = this.connectionService.getChannel();
      const prefetch = resolveRabbitMqPrefetch(
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

      const allBindingTargets = [
        ...outboundBindingTargets,
        ...inboundBindingTargets,
      ];

      if (queueName && allBindingTargets.length > 0) {
        await assertResolvedTopicBindings(channel, {
          version,
          targets: allBindingTargets,
        });
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
        }, queue=${
          queueName ?? 'none'
        }, prefetch=${prefetch}, outboundBindings=${
          outboundBindingTargets.length
        }, inboundBindings=${inboundBindingTargets.length}`,
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
