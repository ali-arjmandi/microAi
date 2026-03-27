import { Client } from '@elastic/elasticsearch';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ELASTICSEARCH_CLIENT } from './elasticsearch.constants';
import {
  SEARCH_INDEX_MAPPINGS,
  SEARCH_INDEX_NAME_DEFAULT,
} from './elasticsearch.index.schema';

@Injectable()
export class ElasticsearchBootstrapService {
  private readonly logger = new Logger(ElasticsearchBootstrapService.name);

  constructor(
    @Inject(ELASTICSEARCH_CLIENT) private readonly client: Client,
    private readonly configService: ConfigService,
  ) {}

  async initialize(): Promise<void> {
    const indexName =
      this.configService.get<string>('ELASTICSEARCH_INDEX') ??
      SEARCH_INDEX_NAME_DEFAULT;

    const indexExists = await this.client.indices.exists({ index: indexName });
    const hasIndex =
      typeof indexExists === 'boolean'
        ? indexExists
        : (indexExists as { body?: boolean }).body === true;

    if (!hasIndex) {
      await this.client.indices.create({
        index: indexName,
        mappings: {
          dynamic: false,
          properties: SEARCH_INDEX_MAPPINGS,
        },
      });
      this.logger.log(`Created Elasticsearch index "${indexName}"`);
      return;
    }

    await this.client.indices.putMapping({
      index: indexName,
      dynamic: false,
      properties: SEARCH_INDEX_MAPPINGS,
    });
    this.logger.log(`Verified Elasticsearch mappings for "${indexName}"`);
  }
}
