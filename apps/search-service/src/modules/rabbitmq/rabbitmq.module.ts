import { Module } from '@nestjs/common';
import { RabbitMqConnectionService } from './rabbitmq.connection.service';
import { RabbitMqStartupService } from './rabbitmq.startup.service';
import { SearchEventPublisher } from './search-event.publisher';

@Module({
  providers: [
    RabbitMqConnectionService,
    RabbitMqStartupService,
    SearchEventPublisher,
  ],
  exports: [
    RabbitMqConnectionService,
    RabbitMqStartupService,
    SearchEventPublisher,
  ],
})
export class RabbitMqModule {}
