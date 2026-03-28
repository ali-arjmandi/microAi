import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'path';
import { SearchServiceModule } from './search-service.module';

async function bootstrap() {
  const app = await NestFactory.create(SearchServiceModule);
  const config = app.get(ConfigService);
  const protoRoot = resolve(process.cwd(), 'libs/common/proto');

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'search',
      protoPath: resolve(protoRoot, 'search/search.proto'),
      url: `${config.get<string>(
        'SEARCH_GRPC_HOST',
        '0.0.0.0',
      )}:${config.get<number>('SEARCH_GRPC_PORT', 50052)}`,
      loader: {
        includeDirs: [protoRoot],
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(config.get<number>('PORT', 3003));
}
bootstrap();
