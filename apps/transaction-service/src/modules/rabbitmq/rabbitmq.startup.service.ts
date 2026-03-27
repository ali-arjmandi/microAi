import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMqConnectionService } from './rabbitmq.connection.service';
import {
  buildVersionedName,
  getTransactionQueueName,
  getTransactionQueueBindingTargets,
  getTransactionOutboxExchange,
  normalizeRoutingKey,
} from './rabbitmq.config';

@Injectable()
export class RabbitMqStartupService {
  private readonly logger = new Logger(RabbitMqStartupService.name);

  constructor(
    private readonly connectionService: RabbitMqConnectionService,
    private readonly configService: ConfigService,
  ) {}

  async initialize(): Promise<void> {
    const version = this.configService.get<string>('RABBITMQ_VERSION');
    const transactionExchangeName = buildVersionedName(
      getTransactionOutboxExchange(),
      version,
    );
    const queueName = buildVersionedName(getTransactionQueueName(), version);
    const bindingTargets = getTransactionQueueBindingTargets();

    try {
      if (!transactionExchangeName && !queueName) {
        this.logger.log(
          'RabbitMQ startup skipped: transaction exchange and queue are not configured',
        );
        return;
      }

      await this.connectionService.connect();
      const channel = this.connectionService.getChannel();
      if (queueName) {
        await channel.assertQueue(queueName, { durable: true });
      }

      if (transactionExchangeName) {
        await channel.assertExchange(transactionExchangeName, 'topic', {
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

      this.logger.log(
        `RabbitMQ startup ready: exchange=${
          transactionExchangeName ?? 'none'
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
