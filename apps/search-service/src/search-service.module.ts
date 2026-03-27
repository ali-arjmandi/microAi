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
    ElasticsearchModule,
  ],
  controllers: [SearchServiceController, HealthController],
  providers: [SearchServiceService, SearchServiceStartupOrchestrator],
})
export class SearchServiceModule {}
