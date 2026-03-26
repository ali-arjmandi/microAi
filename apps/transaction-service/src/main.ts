import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { resolve } from 'path';
import { TransactionServiceModule } from './transaction-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(TransactionServiceModule, {
    transport: Transport.GRPC,
    options: {
      package: 'transaction',
      protoPath: resolve(__dirname, '../../../libs/common/proto/transaction/transaction.proto'),
      url: `${process.env.TRANSACTION_SERVICE_HOST ?? '0.0.0.0'}:${process.env.TRANSACTION_SERVICE_PORT ?? '50051'}`,
    },
  });
  await app.listen();
}
bootstrap();
