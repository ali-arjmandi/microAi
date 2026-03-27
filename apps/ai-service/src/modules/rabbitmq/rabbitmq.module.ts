import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AiConsumer } from './consumers/ai.consumer';
import { AiEventPublisher } from './publishers/ai-event.publisher';
import { RabbitMqConnectionService } from './rabbitmq.connection.service';
import { RabbitMqStartupService } from './rabbitmq.startup.service';

@Module({
  imports: [AiModule],
  providers: [
    RabbitMqConnectionService,
    RabbitMqStartupService,
    AiConsumer,
    AiEventPublisher,
  ],
  exports: [RabbitMqConnectionService, RabbitMqStartupService],
})
export class RabbitMqModule {}
