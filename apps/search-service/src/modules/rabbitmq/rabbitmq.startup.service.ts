import {
  assertResolvedTopicBindings,
  buildVersionedName,
  resolveRabbitMqPrefetch,
} from '@app/common';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsumeMessage } from 'amqplib';
import { ElasticsearchConsumer } from './consumers/elasticsearch.consumer';
import { RabbitMqConnectionService } from './rabbitmq.connection.service';
import {
  getSearchEventsExchange,
  getSearchQueueBindingTargets,
  getSearchQueueInboundBindingTargets,
  getSearchQueueName,
} from './rabbitmq.config';

@Injectable()
export class RabbitMqStartupService {
  private readonly logger = new Logger(RabbitMqStartupService.name);

  constructor(
    private readonly connectionService: RabbitMqConnectionService,
    private readonly configService: ConfigService,
    private readonly elasticsearchConsumer: ElasticsearchConsumer,
  ) {}

  async initialize(): Promise<void> {
    const version = this.configService.get<string>('RABBITMQ_VERSION');
    const searchEventsExchangeName = buildVersionedName(
      getSearchEventsExchange(),
      version,
    );
    const queueName = buildVersionedName(getSearchQueueName(), version);
    const outboundBindingTargets = getSearchQueueBindingTargets();
    const inboundBindingTargets = getSearchQueueInboundBindingTargets();

    try {
      if (!searchEventsExchangeName && !queueName) {
        this.logger.log(
          'RabbitMQ startup skipped: search exchange and queue are not configured',
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

      if (searchEventsExchangeName) {
        await channel.assertExchange(searchEventsExchangeName, 'topic', {
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
              await Promise.resolve(
                this.elasticsearchConsumer.handleMessage(payload),
              );
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
          searchEventsExchangeName ?? 'none'
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
