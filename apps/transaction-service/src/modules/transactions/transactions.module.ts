import { Module } from '@nestjs/common';
import { TransactionRepository } from './transaction.repository';
import { TransactionsService } from './transactions.service';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [OutboxModule],
  providers: [TransactionsService, TransactionRepository],
  exports: [TransactionsService],
})
export class TransactionsModule {}
