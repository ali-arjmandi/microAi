import { Module, forwardRef } from '@nestjs/common';
import { OutboxProcessor } from './outbox.processor';
import { OutboxService } from './outbox.service';
import { OutboxRepository } from './outbox.repository';
import { RabbitMqModule } from '../rabbitmq/rabbitmq.module';

@Module({
  imports: [forwardRef(() => RabbitMqModule)],
  providers: [OutboxService, OutboxProcessor, OutboxRepository],
  exports: [OutboxService, OutboxProcessor, OutboxRepository],
})
export class OutboxModule {}
