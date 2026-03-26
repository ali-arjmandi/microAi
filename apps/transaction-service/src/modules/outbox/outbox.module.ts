import { Module } from '@nestjs/common';
import { OutboxProcessor } from './outbox.processor';
import { OutboxPublisher } from './outbox.publisher';
import { OutboxService } from './outbox.service';

@Module({
  providers: [OutboxService, OutboxPublisher, OutboxProcessor],
  exports: [OutboxService, OutboxPublisher, OutboxProcessor],
})
export class OutboxModule {}
