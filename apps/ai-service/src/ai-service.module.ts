import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { resolve } from 'path';
import { RabbitMqModule } from './modules/rabbitmq/rabbitmq.module';
import { AiModule } from './modules/ai/ai.module';
import { AiServiceStartupOrchestrator } from './ai-service.startup.orchestrator';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [resolve(process.cwd(), 'apps/ai-service/.env')],
      validationSchema: Joi.object({
        PORT: Joi.number().port().default(3004),
        RABBITMQ_URL: Joi.string()
          .uri({ scheme: ['amqp', 'amqps'] })
          .required(),
        RABBITMQ_VERSION: Joi.string().optional(),
        RABBITMQ_PREFETCH: Joi.number().integer().min(1).max(500).default(10),
        OPENROUTER_API_KEY: Joi.string().min(1).required(),
        OPENROUTER_BASE_URL: Joi.string().uri().default(
          'https://openrouter.ai/api/v1',
        ),
        OPENROUTER_MODEL: Joi.string().default('openrouter/free'),
        AI_TIMEOUT_MS: Joi.number().integer().min(1000).default(12000),
        AI_MAX_RETRIES: Joi.number().integer().min(0).max(5).default(2),
      }),
    }),
    AiModule,
    RabbitMqModule,
  ],
  providers: [AiServiceStartupOrchestrator],
})
export class AiServiceModule {}
