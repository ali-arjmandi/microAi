import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { RabbitMqStartupService } from './modules/rabbitmq/rabbitmq.startup.service';

@Injectable()
export class AiServiceStartupOrchestrator implements OnApplicationBootstrap {
  private readonly logger = new Logger(AiServiceStartupOrchestrator.name);

  constructor(
    private readonly rabbitMqStartupService: RabbitMqStartupService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.rabbitMqStartupService.initialize();
    this.logger.log('RabbitMQ startup is ready; AI worker is running');
  }
}
