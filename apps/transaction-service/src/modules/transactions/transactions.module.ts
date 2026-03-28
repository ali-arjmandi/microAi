import { Module, forwardRef } from '@nestjs/common';
import { TransactionRepository } from './transaction.repository';
import { TransactionsService } from './transactions.service';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [forwardRef(() => OutboxModule)],
  providers: [TransactionsService, TransactionRepository],
  exports: [TransactionsService, TransactionRepository],
})
export class TransactionsModule {}
