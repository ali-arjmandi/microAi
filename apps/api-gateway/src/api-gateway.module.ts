import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { resolve } from 'path';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'TRANSACTION_GRPC',
        transport: Transport.GRPC,
        options: {
          package: 'transaction',
          protoPath: resolve('libs/common/proto/transaction/transaction.proto'),
          url: `${process.env.TRANSACTION_SERVICE_HOST ?? 'localhost'}:${
            process.env.TRANSACTION_SERVICE_PORT ?? '50051'
          }`,
        },
      },
    ]),
  ],
  controllers: [ApiGatewayController],
  providers: [ApiGatewayService],
})
export class ApiGatewayModule {}
