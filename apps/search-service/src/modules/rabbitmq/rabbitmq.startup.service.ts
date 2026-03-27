import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMqConnectionService } from './rabbitmq.connection.service';
import { ConsumeMessage } from 'amqplib';
import { ElasticsearchConsumer } from '../elasticsearch/elasticsearch.consumer';
import {
  buildVersionedName,
  getSearchEventsExchange,
  getSearchQueueName,
  getSearchQueueBindingTargets,
  normalizeRoutingKey,
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
    const bindingTargets = getSearchQueueBindingTargets();

    try {
      if (!searchEventsExchangeName && !queueName) {
        this.logger.log(
          'RabbitMQ startup skipped: search exchange and queue are not configured',
        );
        return;
      }

      await this.connectionService.connect();
      const channel = this.connectionService.getChannel();

      if (queueName) {
        await channel.assertQueue(queueName, { durable: true });
      }

      if (searchEventsExchangeName) {
        await channel.assertExchange(searchEventsExchangeName, 'topic', {
          durable: true,
        });
      }

      if (queueName && bindingTargets.length > 0) {
        for (const binding of bindingTargets) {
          const bindingExchangeName = buildVersionedName(
            binding.exchangeName,
            version,
          );
          const routingKey = normalizeRoutingKey(binding.routingKey, version);
          if (!bindingExchangeName) {
            continue;
          }

          await channel.assertExchange(
            bindingExchangeName,
            binding.exchangeType,
            {
              durable: binding.exchangeDurable,
            },
          );
          await channel.bindQueue(queueName, bindingExchangeName, routingKey);
        }
      }

      if (queueName) {
        await channel.consume(
          queueName,
          async (message: ConsumeMessage | null) => {
            if (!message) {
              return;
            }

            try {
              const decodedContent = message.content.toString('utf-8');
              const payload = JSON.parse(decodedContent) as unknown;
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
        }, queue=${queueName ?? 'none'}, bindings=${bindingTargets.length}`,
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
