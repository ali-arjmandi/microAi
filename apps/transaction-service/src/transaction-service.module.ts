import { Module } from '@nestjs/common';
import { DatabaseModule } from './modules/database/prisma.module';
import { HealthController } from './health/health.controller';
import { OutboxModule } from './modules/outbox/outbox.module';
import { TransactionsGrpcController } from './modules/transactions/transactions.grpc.controller';
import { TransactionsModule } from './modules/transactions/transactions.module';

@Module({
  imports: [DatabaseModule, TransactionsModule, OutboxModule],
  controllers: [TransactionsGrpcController, HealthController],
  providers: [],
})
export class TransactionServiceModule {}
