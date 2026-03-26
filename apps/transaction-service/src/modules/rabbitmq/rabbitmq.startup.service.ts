import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMqConnectionService } from './rabbitmq.connection.service';
import { buildVersionedName } from './rabbitmq.config';

@Injectable()
export class RabbitMqStartupService {
  private readonly logger = new Logger(RabbitMqStartupService.name);

  constructor(
    private readonly connectionService: RabbitMqConnectionService,
    private readonly configService: ConfigService,
  ) {}

  async initialize(): Promise<void> {
    const exchangeBase =
      this.configService.get<string>('OUTBOX_EXCHANGE') ?? 'transaction.events';
    const version = this.configService.get<string>('RABBITMQ_VERSION');
    const exchange = buildVersionedName(exchangeBase, version);

    try {
      await this.connectionService.connect();
      const channel = this.connectionService.getChannel();
      await channel.assertExchange(exchange, 'topic', { durable: true });
      this.logger.log(`RabbitMQ exchange is ready: ${exchange}`);
    } catch (error) {
      this.logger.error(
        `RabbitMQ startup bootstrap failed for exchange "${exchange}"`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
