import { Module } from '@nestjs/common';
import { RabbitMqConnectionService } from './rabbitmq.connection.service';
import { RabbitMqStartupService } from './rabbitmq.startup.service';

@Module({
  providers: [RabbitMqConnectionService, RabbitMqStartupService],
  exports: [RabbitMqConnectionService, RabbitMqStartupService],
})
export class RabbitMqModule {}
