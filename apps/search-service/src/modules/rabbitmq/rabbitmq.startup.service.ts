import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMqConnectionService } from './rabbitmq.connection.service';
import { ConsumeMessage } from 'amqplib';
import { ElasticsearchConsumer } from '../elasticsearch/elasticsearch.consumer';
import {
  buildVersionedName,
  getSearchEventsExchange,
  getSearchQueueName,
  getSearchSubscribeRoutingKeys,
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
    const subscribeRoutingKeys = getSearchSubscribeRoutingKeys().map((key) =>
      normalizeRoutingKey(key, version),
    );

    try {
      if (!searchEventsExchangeName && !queueName) {
        this.logger.log(
          'RabbitMQ startup skipped: search exchange and queue are not configured',
        );
        return;
      }

      await this.connectionService.connect();
      const channel = this.connectionService.getChannel();

      if (searchEventsExchangeName) {
        await channel.assertExchange(searchEventsExchangeName, 'topic', {
          durable: true,
        });
      }
      if (queueName) {
        await channel.assertQueue(queueName, { durable: true });
      }

      if (
        searchEventsExchangeName &&
        queueName &&
        subscribeRoutingKeys.length > 0
      ) {
        for (const routingKey of subscribeRoutingKeys) {
          await channel.bindQueue(
            queueName,
            searchEventsExchangeName,
            routingKey,
          );
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
        }, queue=${queueName ?? 'none'}, bindings=${
          subscribeRoutingKeys.length
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
