import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { resolve } from 'path';
import { SearchServiceController } from './search-service.controller';
import { SearchServiceService } from './search-service.service';
import { HealthController } from './health/health.controller';
import { TransactionEventsConsumer } from './modules/rabbitmq/consumers/transaction-events.consumer';
import { IndexingService } from './indexing/indexing.service';
import { mapTransactionEventToSearchDocument } from './indexing/document.mapper';
import { RabbitMqModule } from './modules/rabbitmq/rabbitmq.module';
import { SearchServiceStartupOrchestrator } from './search-service.startup.orchestrator';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [resolve(process.cwd(), 'apps/search-service/.env')],
      validationSchema: Joi.object({
        PORT: Joi.number().port().default(3003),
        ELASTICSEARCH_NODE: Joi.string()
          .uri({ scheme: ['http', 'https'] })
          .required(),
        ELASTICSEARCH_INDEX: Joi.string().default('transactions'),
        RABBITMQ_URL: Joi.string()
          .uri({ scheme: ['amqp', 'amqps'] })
          .required(),
        RABBITMQ_VERSION: Joi.string().optional(),
      }),
    }),
    RabbitMqModule,
  ],
  controllers: [SearchServiceController, HealthController],
  providers: [
    SearchServiceService,
    TransactionEventsConsumer,
    IndexingService,
    {
      provide: 'SEARCH_DOCUMENT_MAPPER',
      useValue: mapTransactionEventToSearchDocument,
    },
    SearchServiceStartupOrchestrator,
  ],
})
export class SearchServiceModule {}
