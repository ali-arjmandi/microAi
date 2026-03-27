import { NestFactory } from '@nestjs/core';
import { AiServiceModule } from './ai-service.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AiServiceModule);
  app.enableShutdownHooks();
}
bootstrap();
