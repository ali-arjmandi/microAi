import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMqConnectionService } from './rabbitmq.connection.service';

@Injectable()
export class RabbitMqStartupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RabbitMqStartupService.name);

  constructor(
    private readonly connectionService: RabbitMqConnectionService,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const exchange =
      this.configService.get<string>('OUTBOX_EXCHANGE') ??
      'transactions.events.v1';

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
