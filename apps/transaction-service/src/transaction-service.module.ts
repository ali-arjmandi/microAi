import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { resolve } from 'path';
import { DatabaseModule } from './modules/database/prisma.module';
import { HealthController } from './health/health.controller';
import { OutboxModule } from './modules/outbox/outbox.module';
import { TransactionsGrpcController } from './modules/transactions/transactions.grpc.controller';
import { TransactionsModule } from './modules/transactions/transactions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [resolve(process.cwd(), 'apps/transaction-service/.env')],
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string()
          .uri({ scheme: ['postgres', 'postgresql'] })
          .required(),
        TRANSACTION_SERVICE_HOST: Joi.string().default('0.0.0.0'),
        TRANSACTION_SERVICE_PORT: Joi.number().port().default(50051),
        RABBITMQ_URL: Joi.string()
          .uri({ scheme: ['amqp', 'amqps'] })
          .required(),
        OUTBOX_EXCHANGE: Joi.string().default('transaction.events'),
      }),
    }),
    DatabaseModule,
    TransactionsModule,
    OutboxModule,
  ],
  controllers: [TransactionsGrpcController, HealthController],
  providers: [],
})
export class TransactionServiceModule {}
