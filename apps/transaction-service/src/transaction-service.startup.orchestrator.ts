import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OutboxProcessor } from './modules/outbox/outbox.processor';
import { RabbitMqStartupService } from './modules/rabbitmq/rabbitmq.startup.service';

@Injectable()
export class TransactionServiceStartupOrchestrator
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(
    TransactionServiceStartupOrchestrator.name,
  );

  constructor(
    private readonly rabbitMqStartupService: RabbitMqStartupService,
    private readonly outboxProcessor: OutboxProcessor,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.rabbitMqStartupService.initialize();
    this.logger.log('RabbitMQ startup is ready; starting outbox processor');
    this.outboxProcessor.startProcessing();
    this.logger.log('Outbox processor is running');
  }
}
