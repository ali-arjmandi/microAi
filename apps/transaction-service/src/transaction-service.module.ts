import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { resolve } from 'path';
import { DatabaseModule } from './modules/database/prisma.module';
import { HealthController } from './health/health.controller';
import { OutboxModule } from './modules/outbox/outbox.module';
import { RabbitMqModule } from './modules/rabbitmq/rabbitmq.module';
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
        RABBITMQ_VERSION: Joi.string().optional(),
        OUTBOX_POLL_INTERVAL_MS: Joi.number().default(2000),
        OUTBOX_BATCH_SIZE: Joi.number().default(100),
        OUTBOX_MAX_RETRIES: Joi.number().default(5),
        OUTBOX_RETRY_BASE_MS: Joi.number().default(1000),
      }),
    }),
    DatabaseModule,
    TransactionsModule,
    OutboxModule,
    RabbitMqModule,
  ],
  controllers: [TransactionsGrpcController, HealthController],
  providers: [],
})
export class TransactionServiceModule {}
