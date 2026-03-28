import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { resolve } from 'path';
import { SearchServiceController } from './search-service.controller';
import { SearchServiceService } from './search-service.service';
import { HealthController } from './health/health.controller';
import { RabbitMqModule } from './modules/rabbitmq/rabbitmq.module';
import { SearchServiceStartupOrchestrator } from './search-service.startup.orchestrator';
import { ElasticsearchModule } from './modules/elasticsearch/elasticsearch.module';
import { ReadinessService } from './health/readiness.service';
import { SearchGrpcController } from './modules/search/search.grpc.controller';
import { TransactionSearchService } from './modules/search/transaction-search.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [resolve(process.cwd(), 'apps/search-service/.env')],
      validationSchema: Joi.object({
        PORT: Joi.number().port().default(3003),
        SEARCH_GRPC_HOST: Joi.string().default('0.0.0.0'),
        SEARCH_GRPC_PORT: Joi.number().port().default(50052),
        SEARCH_MAX_RESULTS: Joi.number().integer().min(1).max(500).default(100),
        ELASTICSEARCH_NODE: Joi.string()
          .uri({ scheme: ['http', 'https'] })
          .required(),
        ELASTICSEARCH_INDEX: Joi.string().default('transactions'),
        RABBITMQ_URL: Joi.string()
          .uri({ scheme: ['amqp', 'amqps'] })
          .required(),
        RABBITMQ_VERSION: Joi.string().optional(),
        RABBITMQ_PREFETCH: Joi.number().integer().min(1).max(500).default(10),
      }),
    }),
    RabbitMqModule,
    ElasticsearchModule,
  ],
  controllers: [
    SearchServiceController,
    HealthController,
    SearchGrpcController,
  ],
  providers: [
    SearchServiceService,
    SearchServiceStartupOrchestrator,
    ReadinessService,
    TransactionSearchService,
  ],
})
export class SearchServiceModule {}
