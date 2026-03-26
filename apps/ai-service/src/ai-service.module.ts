import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { resolve } from 'path';
import { AiServiceController } from './ai-service.controller';
import { AiServiceService } from './ai-service.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [resolve(process.cwd(), 'apps/ai-service/.env')],
      validationSchema: Joi.object({
        PORT: Joi.number().port().default(3004),
      }),
    }),
  ],
  controllers: [AiServiceController],
  providers: [AiServiceService],
})
export class AiServiceModule {}
