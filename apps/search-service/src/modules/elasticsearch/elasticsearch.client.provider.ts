import { Client } from '@elastic/elasticsearch';
import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ELASTICSEARCH_CLIENT } from './elasticsearch.constants';

export const elasticsearchClientProvider: Provider = {
  provide: ELASTICSEARCH_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Client => {
    const node = configService.getOrThrow<string>('ELASTICSEARCH_NODE');
    return new Client({ node });
  },
};
