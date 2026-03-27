import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { resolve } from 'path';
import { RabbitMqModule } from './modules/rabbitmq/rabbitmq.module';
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
      }),
    }),
    RabbitMqModule,
  ],
  providers: [AiServiceStartupOrchestrator],
})
export class AiServiceModule {}
