import { Module } from '@nestjs/common';
import { OutboxProcessor } from './outbox.processor';
import { OutboxPublisher } from './outbox.publisher';
import { OutboxService } from './outbox.service';
import { OutboxRepository } from './outbox.repository';

@Module({
  providers: [
    OutboxService,
    OutboxPublisher,
    OutboxProcessor,
    OutboxRepository,
  ],
  exports: [OutboxService, OutboxPublisher, OutboxProcessor, OutboxRepository],
})
export class OutboxModule {}
