import { Module, forwardRef } from '@nestjs/common';
import { TransactionConsumer } from './consumers/transaction.consumer';
import { TransactionsModule } from '../transactions/transactions.module';
import { RabbitMqConnectionService } from './rabbitmq.connection.service';
import { RabbitMqStartupService } from './rabbitmq.startup.service';
import { OutboxPublisher } from './publishers/outbox.publisher';

@Module({
  imports: [forwardRef(() => TransactionsModule)],
  providers: [
    RabbitMqConnectionService,
    RabbitMqStartupService,
    TransactionConsumer,
    OutboxPublisher,
  ],
  exports: [RabbitMqConnectionService, RabbitMqStartupService, OutboxPublisher],
})
export class RabbitMqModule {}
