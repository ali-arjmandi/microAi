import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { resolve } from 'path';
import { SearchServiceController } from './search-service.controller';
import { SearchServiceService } from './search-service.service';
import { HealthController } from './health/health.controller';
import { TransactionEventsConsumer } from './consumers/transaction-events.consumer';
import { IndexingService } from './indexing/indexing.service';
import { mapTransactionEventToSearchDocument } from './indexing/document.mapper';

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
        RABBITMQ_QUEUE: Joi.string().default('transaction.events'),
      }),
    }),
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
  ],
})
export class SearchServiceModule {}
