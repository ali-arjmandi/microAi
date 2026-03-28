import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import * as Joi from 'joi';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { resolve } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [resolve(process.cwd(), 'apps/api-gateway/.env')],
      validationSchema: Joi.object({
        PORT: Joi.number().port().default(3000),
        TRANSACTION_SERVICE_HOST: Joi.string().hostname().default('localhost'),
        TRANSACTION_SERVICE_PORT: Joi.number().port().default(50051),
        SEARCH_SERVICE_HOST: Joi.string().hostname().default('localhost'),
        SEARCH_SERVICE_GRPC_PORT: Joi.number().port().default(50052),
      }),
    }),
    ClientsModule.registerAsync([
      {
        name: 'TRANSACTION_GRPC',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'transaction',
            protoPath: resolve(
              'libs/common/proto/transaction/transaction.proto',
            ),
            url: `${configService.get<string>(
              'TRANSACTION_SERVICE_HOST',
              'localhost',
            )}:${configService.get<number>('TRANSACTION_SERVICE_PORT', 50051)}`,
          },
        }),
      },
      {
        name: 'SEARCH_GRPC',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const protoRoot = resolve(process.cwd(), 'libs/common/proto');
          return {
            transport: Transport.GRPC,
            options: {
              package: 'search',
              protoPath: resolve(protoRoot, 'search/search.proto'),
              url: `${configService.get<string>(
                'SEARCH_SERVICE_HOST',
                'localhost',
              )}:${configService.get<number>(
                'SEARCH_SERVICE_GRPC_PORT',
                50052,
              )}`,
              loader: {
                includeDirs: [protoRoot],
              },
            },
          };
        },
      },
    ]),
  ],
  controllers: [ApiGatewayController],
  providers: [ApiGatewayService],
})
export class ApiGatewayModule {}
